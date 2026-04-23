import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { RequestUser } from '../common/utils/medico-id';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildTargetPatientMergeData,
  executePatientMergeTransaction,
  type LoadedPatient,
} from './patients-merge-mutation.helpers';

type AssertPatientAccessFn = (user: RequestUser, patientId: string) => Promise<unknown>;

interface MergePatientIntoTargetParams {
  prisma: PrismaService;
  auditService: AuditService;
  user: RequestUser;
  targetPatientId: string;
  sourcePatientId: string;
  assertPatientAccess: AssertPatientAccessFn;
}

export async function mergePatientIntoTarget(params: MergePatientIntoTargetParams) {
  const {
    prisma,
    auditService,
    user,
    targetPatientId,
    sourcePatientId,
    assertPatientAccess,
  } = params;

  if (targetPatientId === sourcePatientId) {
    throw new BadRequestException('Debe seleccionar una ficha distinta para fusionar');
  }

  await Promise.all([
    assertPatientAccess(user, targetPatientId),
    assertPatientAccess(user, sourcePatientId),
  ]);

  const [targetPatient, sourcePatient] = await Promise.all([
    prisma.patient.findUnique({ where: { id: targetPatientId }, include: { history: true } }),
    prisma.patient.findUnique({ where: { id: sourcePatientId }, include: { history: true } }),
  ]);

  if (!targetPatient || targetPatient.archivedAt) {
    throw new NotFoundException('Paciente destino no encontrado');
  }

  if (!sourcePatient || sourcePatient.archivedAt) {
    throw new NotFoundException('Paciente origen no encontrado');
  }

  const { updateData, shouldTransferRut } = buildTargetPatientMergeData({
    targetPatient: targetPatient as LoadedPatient,
    sourcePatient: sourcePatient as LoadedPatient,
    user,
  });

  return executePatientMergeTransaction({
    prisma,
    auditService,
    user,
    targetPatientId,
    sourcePatientId,
    updateData,
    shouldTransferRut,
    targetPatient: targetPatient as LoadedPatient,
    sourcePatient: sourcePatient as LoadedPatient,
  });
}
