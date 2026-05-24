import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import type { StringValue } from 'ms';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { decryptField, encryptNetMeta } from '../common/utils/field-crypto';
import { EncountersPdfService } from '../encounters/encounters-pdf.service';
import { resolvePatientIdentifiers, withPatientIdentifiers } from '../patients/patients-identifiers';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import {
  PortalActivateDto,
  PortalDataRequestDto,
  PortalInviteDto,
  PortalLoginDto,
  PortalRequestPasswordResetDto,
  PortalResetPasswordDto,
} from './dto/patient-portal.dto';
import type { PatientPortalJwtPayload, PatientPortalRequestUser } from './patient-portal.types';

const PORTAL_ACTIVATION_TTL_HOURS = 7 * 24;
const PORTAL_RESET_TTL_MINUTES = 30;
const PORTAL_LOCK_ATTEMPTS = 5;
const PORTAL_LOCK_MINUTES = 15;
const DATA_REQUEST_SLA_DAYS = 30;

type SessionContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
  sessionId?: string;
};

@Injectable()
export class PatientPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly encountersPdf: EncountersPdfService,
  ) {}

  async invitePatient(patientId: string, dto: PortalInviteDto, admin: CurrentUserData) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, nombreEnc: true, archivedAt: true },
    });
    if (!patient || patient.archivedAt) throw new NotFoundException('Paciente no encontrado');
    const patientIdentifiers = resolvePatientIdentifiers(patient);

    const token = randomBytes(32).toString('base64url');
    const activationTokenHash = hashToken(token);
    const activationExpiresAt = new Date(Date.now() + PORTAL_ACTIVATION_TTL_HOURS * 60 * 60 * 1000);
    const account = await this.prisma.patientPortalAccount.upsert({
      where: { email: dto.email },
      create: {
        patientId,
        email: dto.email,
        relationship: dto.relationship,
        activationTokenHash,
        activationExpiresAt,
        createdById: admin.id,
      },
      update: {
        patientId,
        relationship: dto.relationship,
        activationTokenHash,
        activationExpiresAt,
        active: false,
      },
    });

    const activationUrl = this.buildPortalUrl(`/portal/activar?token=${encodeURIComponent(token)}`);
    const mailResult = await this.mail.sendPatientPortalInvite({
      to: dto.email,
      patientName: patientIdentifiers.nombre,
      activationUrl,
      expiresAt: activationExpiresAt,
    });
    await this.audit.log({
      entityType: 'PatientPortalAccount',
      entityId: account.id,
      userId: admin.id,
      action: 'CREATE',
      diff: { patientId, relationship: dto.relationship, emailDomain: dto.email.split('@')[1] ?? null },
    });

    return { id: account.id, email: account.email, activationUrl, expiresAt: activationExpiresAt, mail: mailResult };
  }

  async activate(dto: PortalActivateDto, context?: SessionContext) {
    if (!dto.acceptPrivacy || !dto.acceptTerms) {
      throw new BadRequestException('Debe aceptar la política de privacidad y términos para activar el portal');
    }
    const tokenHash = hashToken(dto.token);
    const account = await this.prisma.patientPortalAccount.findUnique({ where: { activationTokenHash: tokenHash } });
    if (!account || !account.activationExpiresAt || account.activationExpiresAt < new Date()) {
      throw new UnauthorizedException('Enlace de activación inválido o expirado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const updated = await this.prisma.patientPortalAccount.update({
      where: { id: account.id },
      data: {
        passwordHash,
        active: true,
        emailVerifiedAt: new Date(),
        activationTokenHash: null,
        activationExpiresAt: null,
        legalAcceptedAt: new Date(),
        legalAcceptance: {
          privacy: true,
          terms: true,
          acceptedAt: new Date().toISOString(),
        },
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
    return this.issueTokens(updated, context);
  }

  async login(dto: PortalLoginDto, context?: SessionContext) {
    const account = await this.prisma.patientPortalAccount.findUnique({ where: { email: dto.email } });
    if (!account || !account.active || !account.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (account.lockedUntil && account.lockedUntil > new Date()) {
      throw new UnauthorizedException('Cuenta temporalmente bloqueada');
    }
    const ok = await bcrypt.compare(dto.password, account.passwordHash);
    if (!ok) {
      const failedAttempts = account.failedAttempts + 1;
      await this.prisma.patientPortalAccount.update({
        where: { id: account.id },
        data: {
          failedAttempts,
          lockedUntil: failedAttempts >= PORTAL_LOCK_ATTEMPTS
            ? new Date(Date.now() + PORTAL_LOCK_MINUTES * 60 * 1000)
            : null,
        },
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }
    await this.prisma.patientPortalAccount.update({
      where: { id: account.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });
    await this.audit.log({
      entityType: 'PatientPortalAccount',
      entityId: account.id,
      userId: `portal:${account.id}`,
      action: 'LOGIN',
      reason: 'PATIENT_PORTAL_LOGIN',
      diff: { patientId: account.patientId },
    });
    return this.issueTokens(account, context);
  }

  async refresh(refreshToken: string, context?: SessionContext) {
    let payload: PatientPortalJwtPayload;
    try {
      payload = this.jwtService.verify<PatientPortalJwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Token de refresco inválido');
    }
    if (payload.typ !== 'patient_portal' || typeof payload.sid !== 'string' || typeof payload.sv !== 'number') {
      throw new UnauthorizedException('Token de refresco inválido');
    }
    const account = await this.prisma.patientPortalAccount.findUnique({ where: { id: payload.sub } });
    if (!account?.active || payload.rv !== account.refreshTokenVersion) {
      throw new UnauthorizedException('Cuenta de portal inválida');
    }
    const session = await this.prisma.patientPortalSession.update({
      where: { id: payload.sid },
      data: {
        tokenVersion: { increment: 1 },
        lastUsedAt: new Date(),
        userAgent: encryptNetMeta(context?.userAgent?.slice(0, 255)),
        ipAddress: encryptNetMeta(context?.ipAddress?.slice(0, 64)),
      },
    });
    return this.signTokens(account, session.id, session.tokenVersion);
  }

  async logout(accountId: string, sessionId?: string) {
    if (sessionId) {
      await this.prisma.patientPortalSession.updateMany({
        where: { id: sessionId, accountId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { message: 'Sesión cerrada' };
  }

  async me(user: PatientPortalRequestUser) {
    return user;
  }

  async requestPasswordReset(dto: PortalRequestPasswordResetDto, context?: SessionContext) {
    const account = await this.prisma.patientPortalAccount.findUnique({ where: { email: dto.email } });
    if (!account?.active) return { message: 'Si el correo está registrado, recibirás instrucciones.' };
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + PORTAL_RESET_TTL_MINUTES * 60 * 1000);
    await this.prisma.patientPortalPasswordResetToken.create({
      data: {
        accountId: account.id,
        tokenHash: hashToken(token),
        expiresAt,
        ipAddress: encryptNetMeta(context?.ipAddress?.slice(0, 64)),
        userAgent: encryptNetMeta(context?.userAgent?.slice(0, 255)),
      },
    });
    await this.mail.sendPatientPortalPasswordReset({
      to: account.email,
      resetUrl: this.buildPortalUrl(`/portal/login?resetToken=${encodeURIComponent(token)}`),
      expiresAt,
    });
    return { message: 'Si el correo está registrado, recibirás instrucciones.' };
  }

  async resetPassword(dto: PortalResetPasswordDto) {
    const tokenHash = hashToken(dto.token);
    const token = await this.prisma.patientPortalPasswordResetToken.findUnique({
      where: { tokenHash },
      include: { account: true },
    });
    if (!token || token.usedAt || token.expiresAt < new Date() || !token.account.active) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    await this.prisma.$transaction([
      this.prisma.patientPortalAccount.update({
        where: { id: token.accountId },
        data: {
          passwordHash: await bcrypt.hash(dto.password, 12),
          refreshTokenVersion: { increment: 1 },
          failedAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.patientPortalPasswordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.patientPortalSession.updateMany({
        where: { accountId: token.accountId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { message: 'Contraseña actualizada' };
  }

  async getPatient(user: PatientPortalRequestUser) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: user.patientId },
      select: {
        id: true,
        rutEnc: true,
        rutExempt: true,
        nombreEnc: true,
        fechaNacimiento: true,
        edad: true,
        edadMeses: true,
        sexo: true,
        prevision: true,
        emailEnc: true,
        telefonoEnc: true,
        legalRepresentativeName: true,
        legalRepresentativeRelationship: true,
        legalRepresentativeNameEnc: true,
        legalRepresentativeRelationshipEnc: true,
      },
    });
    if (!patient) throw new NotFoundException('Paciente no encontrado');
    const patientWithIdentifiers = withPatientIdentifiers(patient);
    await this.audit.log({
      entityType: 'Patient',
      entityId: patient.id,
      userId: `portal:${user.id}`,
      action: 'READ',
      reason: 'PATIENT_PORTAL_RECORD_VIEWED',
    });
    return patientWithIdentifiers;
  }

  async listEncounters(user: PatientPortalRequestUser) {
    const encounters = await this.prisma.encounter.findMany({
      where: { patientId: user.patientId, status: { in: ['COMPLETADO', 'FIRMADO'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        status: true,
        reviewStatus: true,
        medico: { select: { nombre: true } },
      },
    });
    return encounters.map((encounter) => ({
      ...encounter,
      fecha: encounter.createdAt,
      tipoAtencion: null,
      motivoConsulta: null,
    }));
  }

  async getEncounter(user: PatientPortalRequestUser, encounterId: string) {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id: encounterId, patientId: user.patientId, status: { in: ['COMPLETADO', 'FIRMADO'] } },
      include: {
        sections: true,
        attachments: {
          where: { deletedAt: null },
          select: { id: true, originalName: true, mime: true, size: true, category: true, uploadedAt: true },
        },
        medico: { select: { nombre: true } },
      },
    });
    if (!encounter) throw new NotFoundException('Atención no encontrada');
    await this.audit.log({
      entityType: 'Encounter',
      entityId: encounter.id,
      userId: `portal:${user.id}`,
      action: 'READ',
      reason: 'PATIENT_PORTAL_ENCOUNTER_VIEWED',
    });
    return {
      ...encounter,
      fecha: encounter.createdAt,
      tipoAtencion: null,
      motivoConsulta: null,
      sections: encounter.sections.map((section) => ({
        id: section.id,
        sectionKey: section.sectionKey,
        completed: section.completed,
        notApplicable: section.notApplicable,
        data: parseSectionData(section.data),
        updatedAt: section.updatedAt,
      })),
    };
  }

  async exportEncounterPdf(user: PatientPortalRequestUser, encounterId: string) {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id: encounterId, patientId: user.patientId, status: { in: ['COMPLETADO', 'FIRMADO'] } },
      select: { id: true, medicoId: true },
    });
    if (!encounter) throw new NotFoundException('Atención no encontrada');
    const syntheticUser = {
      id: encounter.medicoId,
      email: user.email,
      nombre: 'Portal paciente',
      role: 'MEDICO',
      isAdmin: false,
    };
    const filename = await this.encountersPdf.getPdfFilename(encounterId, syntheticUser);
    const buffer = await this.encountersPdf.generatePdf(encounterId, syntheticUser);
    await this.audit.log({
      entityType: 'Encounter',
      entityId: encounterId,
      userId: `portal:${user.id}`,
      action: 'EXPORT',
      reason: 'PATIENT_PORTAL_DOCUMENT_DOWNLOADED',
      diff: { patientId: user.patientId },
    });
    return { filename, buffer };
  }

  async createDataRequest(user: PatientPortalRequestUser, dto: PortalDataRequestDto) {
    const patient = await this.prisma.patient.findUnique({ where: { id: user.patientId } });
    if (!patient) throw new NotFoundException('Paciente no encontrado');
    const patientIdentifiers = resolvePatientIdentifiers(patient);
    const now = new Date();
    const created = await this.prisma.patientDataRequest.create({
      data: {
        patientId: user.patientId,
        requestType: dto.requestType,
        status: 'RECIBIDA',
        submittedBy: user.relationship === 'TITULAR' ? 'TITULAR' : 'REPRESENTANTE',
        requesterName: patientIdentifiers.nombre,
        requesterRut: dto.requesterRut ?? patientIdentifiers.rut,
        requesterEmail: user.email,
        payloadRequest: dto.payloadRequest,
        dueDate: new Date(now.getTime() + DATA_REQUEST_SLA_DAYS * 24 * 60 * 60 * 1000),
        identityVerificationMethod: 'PORTAL',
        identityVerificationEvidence: {
          portalAccountId: user.id,
          relationship: user.relationship,
          submittedAt: now.toISOString(),
        },
      },
    });
    await this.audit.log({
      entityType: 'PatientDataRequest',
      entityId: created.id,
      userId: `portal:${user.id}`,
      action: 'CREATE',
      reason: 'PATIENT_PORTAL_DATA_REQUEST_CREATED',
      diff: { patientId: user.patientId, requestType: dto.requestType },
    });
    return created;
  }

  private async issueTokens(account: { id: string; email: string; patientId: string; relationship: string; refreshTokenVersion: number }, context?: SessionContext) {
    const session = await this.prisma.patientPortalSession.create({
      data: {
        accountId: account.id,
        tokenVersion: 1,
        userAgent: encryptNetMeta(context?.userAgent?.slice(0, 255)),
        ipAddress: encryptNetMeta(context?.ipAddress?.slice(0, 64)),
        lastUsedAt: new Date(),
      },
    });
    return this.signTokens(account, session.id, session.tokenVersion);
  }

  private signTokens(account: { id: string; email: string; refreshTokenVersion: number }, sessionId: string, tokenVersion: number) {
    const payload: PatientPortalJwtPayload = {
      sub: account.id,
      email: account.email,
      typ: 'patient_portal',
      sid: sessionId,
      sv: tokenVersion,
    };
    const refreshPayload: PatientPortalJwtPayload = {
      ...payload,
      rv: account.refreshTokenVersion,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(refreshPayload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as StringValue,
      }),
    };
  }

  private buildPortalUrl(pathname: string) {
    const baseUrl = this.configService.get<string>('APP_PUBLIC_URL')
      || this.configService.get<string>('FRONTEND_PUBLIC_URL')
      || 'http://localhost:5555';
    return `${baseUrl.replace(/\/$/, '')}${pathname}`;
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseSectionData(raw: string): unknown {
  try {
    return JSON.parse(decryptField(raw));
  } catch {
    return { __unavailable: true };
  }
}
