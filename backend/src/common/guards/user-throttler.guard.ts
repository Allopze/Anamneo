import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Throttler que prefiere identificar al usuario autenticado por sessionId/userId
 * sobre la IP, para que clinicas detras de NAT compartido no se rate-limiteen
 * mutuamente. Si no hay sesion, cae a la IP del request.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const user = (req as Request & { user?: { id?: string; sessionId?: string } }).user;
    if (user?.sessionId) return `sid:${user.sessionId}`;
    if (user?.id) return `uid:${user.id}`;
    return req.ip ?? 'unknown';
  }
}
