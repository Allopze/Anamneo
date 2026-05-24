import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PatientNotBlockedGuard } from './patient-not-blocked.guard';

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('PatientNotBlockedGuard', () => {
  function buildGuard(overrides?: {
    patient?: jest.Mock;
    encounter?: jest.Mock;
    attachment?: jest.Mock;
    patientProblem?: jest.Mock;
    encounterTask?: jest.Mock;
    clinicalAlert?: jest.Mock;
    clinicalConsent?: jest.Mock;
  }) {
    const prisma = {
      patient: { findUnique: overrides?.patient ?? jest.fn().mockResolvedValue(null) },
      encounter: { findUnique: overrides?.encounter ?? jest.fn().mockResolvedValue(null) },
      attachment: { findUnique: overrides?.attachment ?? jest.fn().mockResolvedValue(null) },
      patientProblem: { findUnique: overrides?.patientProblem ?? jest.fn().mockResolvedValue(null) },
      encounterTask: { findUnique: overrides?.encounterTask ?? jest.fn().mockResolvedValue(null) },
      clinicalAlert: { findUnique: overrides?.clinicalAlert ?? jest.fn().mockResolvedValue(null) },
      clinicalConsent: { findUnique: overrides?.clinicalConsent ?? jest.fn().mockResolvedValue(null) },
    } as never;

    return { guard: new PatientNotBlockedGuard(prisma), prisma };
  }

  it('permite lecturas aunque la ruta tenga patientId', async () => {
    const patientFind = jest.fn();
    const { guard } = buildGuard({ patient: patientFind });

    await expect(
      guard.canActivate(buildContext({ method: 'GET', params: { patientId: 'p-1' } })),
    ).resolves.toBe(true);

    expect(patientFind).not.toHaveBeenCalled();
  });

  it('bloquea mutaciones con patientId directo cuando el paciente esta bloqueado', async () => {
    const { guard } = buildGuard({
      patient: jest.fn().mockResolvedValue({
        id: 'p-1',
        blockedAt: new Date(),
        blockedReason: 'solicitud vigente',
      }),
    });

    await expect(
      guard.canActivate(buildContext({ method: 'POST', params: { patientId: 'p-1' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resuelve patientId desde problemId para mutaciones de problemas', async () => {
    const patientFind = jest.fn().mockResolvedValue({ id: 'p-1', blockedAt: null, blockedReason: null });
    const problemFind = jest.fn().mockResolvedValue({ patientId: 'p-1' });
    const { guard } = buildGuard({ patient: patientFind, patientProblem: problemFind });

    await expect(
      guard.canActivate(buildContext({
        method: 'PUT',
        params: { problemId: 'problem-1' },
        route: { path: '/patients/problems/:problemId' },
      })),
    ).resolves.toBe(true);

    expect(problemFind).toHaveBeenCalledWith({
      where: { id: 'problem-1' },
      select: { patientId: true },
    });
    expect(patientFind).toHaveBeenCalledWith({
      where: { id: 'p-1' },
      select: { id: true, blockedAt: true, blockedReason: true },
    });
  });

  it('resuelve patientId desde encounterId para mutaciones de atenciones', async () => {
    const patientFind = jest.fn().mockResolvedValue({ id: 'p-1', blockedAt: null, blockedReason: null });
    const encounterFind = jest.fn().mockResolvedValue({ patientId: 'p-1' });
    const { guard } = buildGuard({ patient: patientFind, encounter: encounterFind });

    await expect(
      guard.canActivate(buildContext({
        method: 'PATCH',
        params: { encounterId: 'enc-1' },
        baseUrl: '/api/encounters',
        route: { path: '/:encounterId/sections/:sectionKey' },
      })),
    ).resolves.toBe(true);

    expect(encounterFind).toHaveBeenCalledWith({
      where: { id: 'enc-1' },
      select: { patientId: true },
    });
    expect(patientFind).toHaveBeenCalled();
  });

  it('resuelve patientId desde attachment id para mutaciones de adjuntos', async () => {
    const patientFind = jest.fn().mockResolvedValue({ id: 'p-1', blockedAt: null, blockedReason: null });
    const attachmentFind = jest.fn().mockResolvedValue({ encounter: { patientId: 'p-1' } });
    const { guard } = buildGuard({ patient: patientFind, attachment: attachmentFind });

    await expect(
      guard.canActivate(buildContext({
        method: 'DELETE',
        params: { id: 'att-1' },
        baseUrl: '/api/attachments',
        route: { path: '/:id' },
      })),
    ).resolves.toBe(true);

    expect(attachmentFind).toHaveBeenCalledWith({
      where: { id: 'att-1' },
      select: { encounter: { select: { patientId: true } } },
    });
    expect(patientFind).toHaveBeenCalled();
  });

  it('resuelve patientId desde alerta clinica para acknowledge', async () => {
    const patientFind = jest.fn().mockResolvedValue({ id: 'p-1', blockedAt: null, blockedReason: null });
    const alertFind = jest.fn().mockResolvedValue({ patientId: 'p-1' });
    const { guard } = buildGuard({ patient: patientFind, clinicalAlert: alertFind });

    await expect(
      guard.canActivate(buildContext({
        method: 'POST',
        params: { id: 'alert-1' },
        baseUrl: '/api/alerts',
        route: { path: '/:id/acknowledge' },
      })),
    ).resolves.toBe(true);

    expect(alertFind).toHaveBeenCalledWith({
      where: { id: 'alert-1' },
      select: { patientId: true },
    });
    expect(patientFind).toHaveBeenCalled();
  });

  it('resuelve patientId desde taskId para mutaciones de tareas', async () => {
    const patientFind = jest.fn().mockResolvedValue({ id: 'p-1', blockedAt: null, blockedReason: null });
    const taskFind = jest.fn().mockResolvedValue({ patientId: 'p-1' });
    const { guard } = buildGuard({ patient: patientFind, encounterTask: taskFind });

    await expect(
      guard.canActivate(buildContext({
        method: 'PUT',
        params: { taskId: 'task-1' },
        route: { path: '/patients/tasks/:taskId' },
      })),
    ).resolves.toBe(true);

    expect(taskFind).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      select: { patientId: true },
    });
    expect(patientFind).toHaveBeenCalled();
  });

  it('resuelve patientId desde consentimiento clinico revocado', async () => {
    const patientFind = jest.fn().mockResolvedValue({ id: 'p-1', blockedAt: null, blockedReason: null });
    const consentFind = jest.fn().mockResolvedValue({ patientId: 'p-1' });
    const { guard } = buildGuard({ patient: patientFind, clinicalConsent: consentFind });

    await expect(
      guard.canActivate(buildContext({
        method: 'POST',
        params: { id: 'consent-1' },
        baseUrl: '/api/consents',
        route: { path: '/:id/revoke' },
      })),
    ).resolves.toBe(true);

    expect(consentFind).toHaveBeenCalledWith({
      where: { id: 'consent-1' },
      select: { patientId: true },
    });
    expect(patientFind).toHaveBeenCalled();
  });
});
