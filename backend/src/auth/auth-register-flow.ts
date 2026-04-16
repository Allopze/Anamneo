import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UsersInvitationService } from '../users/users-invitation.service';
import { RegisterWithInvitationDto } from './dto/register-with-invitation.dto';
import { Role } from './dto/register.dto';

type SessionContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
  sessionId?: string;
};

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

type IssueTokensFn = (
  user: { id: string; email: string; role: string },
  sessionContext?: SessionContext,
) => Promise<AuthTokens>;
type NormalizeEmailFn = (email: string) => string;
type GetConfiguredBootstrapTokenFn = () => string | null;
type HasValidBootstrapTokenFn = (candidateToken: string | undefined, expectedToken: string | null) => boolean;

interface RegisterWithInvitationFlowParams {
  usersService: UsersService;
  invitationService: UsersInvitationService;
  registerDto: RegisterWithInvitationDto;
  sessionContext?: SessionContext;
  issueTokens: IssueTokensFn;
  normalizeEmail: NormalizeEmailFn;
  getConfiguredBootstrapToken: GetConfiguredBootstrapTokenFn;
  hasValidBootstrapToken: HasValidBootstrapTokenFn;
}

interface InvitationPreviewFlowParams {
  invitationService: UsersInvitationService;
  token: string;
}

interface BootstrapStateFlowParams {
  usersService: UsersService;
  getConfiguredBootstrapToken: GetConfiguredBootstrapTokenFn;
}

export async function getInvitationPreviewFlow(params: InvitationPreviewFlowParams) {
  const { invitationService, token } = params;

  const invitation = await invitationService.findInvitationByToken(token);

  if (!invitation) {
    throw new ForbiddenException('La invitación es inválida o expiró');
  }

  return {
    email: invitation.email,
    role: invitation.role,
    medicoId: invitation.medicoId,
    expiresAt: invitation.expiresAt,
  };
}

export async function registerWithInvitationFlow(
  params: RegisterWithInvitationFlowParams,
): Promise<AuthTokens> {
  const {
    usersService,
    invitationService,
    registerDto,
    sessionContext,
    issueTokens,
    normalizeEmail,
    getConfiguredBootstrapToken,
    hasValidBootstrapToken,
  } = params;

  const normalizedEmail = normalizeEmail(registerDto.email);

  const existingUser = await usersService.findByEmail(normalizedEmail);
  if (existingUser) {
    throw new ConflictException('Ya existe un usuario con este email');
  }

  const requestedRole: Role = registerDto.role || 'ASISTENTE';
  const adminCount = await usersService.countActiveAdmins();
  const hasAdmin = adminCount > 0;
  const invitationToken = registerDto.invitationToken?.trim();
  const bootstrapToken = registerDto.bootstrapToken?.trim();
  const configuredBootstrapToken = getConfiguredBootstrapToken();

  let invitation: Awaited<ReturnType<UsersInvitationService['findInvitationByToken']>> | null = null;

  if (hasAdmin) {
    if (!invitationToken) {
      throw new ForbiddenException('El registro público está deshabilitado. Debe usar una invitación válida');
    }

    invitation = await invitationService.findInvitationByToken(invitationToken);
    if (!invitation) {
      throw new ForbiddenException('La invitación es inválida o expiró');
    }

    if (invitation.email !== normalizedEmail) {
      throw new ForbiddenException('El email no coincide con la invitación');
    }

    if (invitation.role !== requestedRole) {
      throw new ForbiddenException('El rol no coincide con la invitación');
    }

    if (invitation.medicoId) {
      const invitedMedico = await usersService.findById(invitation.medicoId);

      if (!invitedMedico || invitedMedico.role !== 'MEDICO' || !invitedMedico.active) {
        throw new ForbiddenException('El médico asignado en la invitación ya no está disponible');
      }
    }
  }

  if (requestedRole === 'ADMIN') {
    if (adminCount > 0 && !invitation) {
      throw new ForbiddenException('Ya existe un administrador registrado. El acceso es solo por invitación');
    }
  }

  if (!hasAdmin) {
    if (requestedRole !== 'ADMIN') {
      throw new ForbiddenException('El primer registro debe crear la cuenta administradora inicial');
    }

    if (!hasValidBootstrapToken(bootstrapToken, configuredBootstrapToken)) {
      throw new ForbiddenException('El registro inicial requiere un token de instalación válido');
    }
  }

  const user = await usersService.create({
    email: normalizedEmail,
    password: registerDto.password,
    nombre: registerDto.nombre,
    role: requestedRole,
    ...(invitation?.medicoId ? { medicoId: invitation.medicoId } : {}),
    ...(requestedRole === 'ASISTENTE' && !invitation?.medicoId ? { allowUnassignedAssistant: true } : {}),
  });

  if (invitation) {
    await invitationService.acceptInvitation(invitation.id);
  }

  return issueTokens(user, sessionContext);
}

export async function getBootstrapStateFlow(params: BootstrapStateFlowParams) {
  const { usersService, getConfiguredBootstrapToken } = params;

  const userCount = await usersService.countUsers();
  const adminCount = await usersService.countActiveAdmins();
  const hasAdmin = adminCount > 0;
  const requiresBootstrapToken = !hasAdmin && Boolean(getConfiguredBootstrapToken());

  return {
    userCount,
    isEmpty: userCount === 0,
    hasAdmin,
    requiresBootstrapToken,
    registerableRoles: hasAdmin ? ([] as const) : (['ADMIN'] as const),
  };
}
