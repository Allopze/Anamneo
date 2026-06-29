import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface SessionUser {
  id: string;
  email: string;
  nombre: string;
  role: string;
  isAdmin: boolean;
  medicoId: string | null;
  mustChangePassword: boolean;
  totpEnabled: boolean;
}

type RawUser = {
  id: string;
  email: string;
  nombre: string;
  role: string;
  isAdmin?: boolean | null;
  medicoId?: string | null;
  mustChangePassword?: boolean | null;
  totpEnabled?: boolean | null;
  active?: boolean | null;
};

export function toSessionUser(user: RawUser): SessionUser {
  if (!user.active) {
    throw new UnauthorizedException('Usuario no encontrado o inactivo');
  }

  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    role: user.role,
    isAdmin: !!user.isAdmin,
    medicoId: user.medicoId ?? null,
    mustChangePassword: !!user.mustChangePassword,
    totpEnabled: !!user.totpEnabled,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getConfiguredBootstrapToken(configService: ConfigService): string | null {
  const token = configService.get<string>('BOOTSTRAP_TOKEN')?.trim();
  return token ? token : null;
}

export function hasValidBootstrapToken(candidateToken: string | undefined, expectedToken: string | null) {
  if (!expectedToken) {
    return true;
  }

  const normalizedCandidate = candidateToken?.trim();
  if (!normalizedCandidate) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedToken);
  const candidateBuffer = Buffer.from(normalizedCandidate);
  if (expectedBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, candidateBuffer);
}
