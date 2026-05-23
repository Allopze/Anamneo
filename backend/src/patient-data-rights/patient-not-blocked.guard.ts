import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Ley 21.719 Art 8 ter (bloqueo temporal). Cuando un Patient esta marcado
 * con `blockedAt`, este guard bloquea cualquier mutacion clinica sobre el.
 *
 * Para usarlo en un endpoint:
 *
 *   @UseGuards(JwtAuthGuard, PatientNotBlockedGuard)
 *   ...
 *
 * El guard resuelve `patientId` en este orden:
 *   1. req.params.patientId               (ruta /patient/:patientId/...)
 *   2. req.body.patientId                 (body con patientId explicito)
 *   3. req.params.encounterId → Encounter.patientId
 *   4. req.params.id en rutas /encounters/:id/*  → Encounter.patientId
 *   5. req.params.id en rutas /attachments/:id/* → Attachment.encounter.patientId
 *   6. req.params.id en rutas /patients/:id/*    → directo
 *
 * Si no logra resolver patientId, deja pasar (el handler decidira 404/403).
 */
@Injectable()
export class PatientNotBlockedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const patientId = await this.resolvePatientId(req);
    if (!patientId) {
      return true; // sin patient identificable, dejamos pasar
    }
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, blockedAt: true, blockedReason: true },
    });
    if (!patient) return true; // 404 se decide en el handler
    if (patient.blockedAt) {
      throw new ForbiddenException(
        `Paciente con bloqueo temporal vigente (Ley 21.719 Art 8 ter). ` +
        `Motivo: ${patient.blockedReason ?? 'no especificado'}. ` +
        `Levante el bloqueo antes de continuar con el tratamiento.`,
      );
    }
    return true;
  }

  private async resolvePatientId(req: {
    params?: Record<string, string>;
    body?: Record<string, unknown>;
    route?: { path?: string };
    url?: string;
  }): Promise<string | undefined> {
    const params = req.params ?? {};
    if (params.patientId) return params.patientId;
    if (typeof req.body?.patientId === 'string') return req.body.patientId as string;

    const path = req.route?.path ?? req.url ?? '';

    // /encounters/:encounterId, /encounters/:id, /encounters/:id/complete
    if (params.encounterId || (path.includes('/encounters') && params.id)) {
      const encounterId = params.encounterId ?? params.id;
      if (encounterId) {
        const enc = await this.prisma.encounter.findUnique({
          where: { id: encounterId },
          select: { patientId: true },
        });
        if (enc?.patientId) return enc.patientId;
      }
    }

    // /attachments/:id, /attachments/:id/download
    if (path.includes('/attachments') && params.id) {
      const att = await this.prisma.attachment.findUnique({
        where: { id: params.id },
        select: { encounter: { select: { patientId: true } } },
      });
      if (att?.encounter?.patientId) return att.encounter.patientId;
    }

    // /patients/:id/*
    if (path.includes('/patients') && params.id) {
      return params.id;
    }

    return undefined;
  }
}
