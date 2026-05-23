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
 * El guard lee `patientId` del request en este orden:
 *   1. req.params.patientId
 *   2. req.params.id    (cuando la ruta es /patients/:id/*)
 *   3. req.body.patientId
 */
@Injectable()
export class PatientNotBlockedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const patientId: string | undefined =
      req?.params?.patientId ?? req?.params?.id ?? req?.body?.patientId;
    if (!patientId) {
      // Sin patientId no hay nada que bloquear; deja pasar al handler.
      return true;
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
}
