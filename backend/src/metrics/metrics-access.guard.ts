import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { timingSafeEqual } from 'crypto';

function readBearerToken(raw?: string): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

@Injectable()
export class MetricsAccessGuard extends AuthGuard('jwt') implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const configuredToken = process.env.METRICS_SCRAPE_TOKEN?.trim();
    const providedToken = request.get('x-metrics-token')?.trim()
      || readBearerToken(request.get('authorization'));

    if (
      configuredToken
      && providedToken
      && constantTimeEquals(providedToken, configuredToken)
    ) {
      return true;
    }

    const authenticated = await Promise.resolve(super.canActivate(context) as boolean | Promise<boolean>);
    if (!authenticated) return false;

    if (!request.user?.isAdmin) {
      throw new ForbiddenException('No tiene permisos para consultar métricas');
    }

    return true;
  }
}
