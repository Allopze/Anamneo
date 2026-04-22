import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseStoredJson } from '../common/utils/encounter-sections';
import {
  LINKABLE_ORDER_FIELDS,
  type LinkedOrderType,
  type AttachmentMetadata,
  type StructuredOrder,
} from './attachments-helpers';

export async function resolveLinkedOrder(
  prisma: PrismaService,
  encounterId: string,
  metadata?: AttachmentMetadata,
): Promise<{ linkedOrderType: LinkedOrderType; linkedOrderId: string; linkedOrderLabel: string } | null> {
  const linkedOrderId = metadata?.linkedOrderId?.trim();
  const linkedOrderTypeRaw = metadata?.linkedOrderType?.trim().toUpperCase();

  if (!linkedOrderId && !linkedOrderTypeRaw) {
    return null;
  }

  if (!linkedOrderId || !linkedOrderTypeRaw) {
    throw new BadRequestException('Debe indicar el tipo y el identificador del item vinculado');
  }

  if (!(linkedOrderTypeRaw in LINKABLE_ORDER_FIELDS)) {
    throw new BadRequestException('El tipo de item vinculado no es valido');
  }

  const treatmentSection = await prisma.encounterSection.findUnique({
    where: {
      encounterId_sectionKey: {
        encounterId,
        sectionKey: 'TRATAMIENTO',
      },
    },
    select: {
      data: true,
    },
  });

  const treatmentData = parseStoredJson<Record<string, StructuredOrder[]>>(treatmentSection?.data, {});
  const orderField = LINKABLE_ORDER_FIELDS[linkedOrderTypeRaw as LinkedOrderType];
  const order = (Array.isArray(treatmentData[orderField]) ? treatmentData[orderField] : []).find(
    (item) => item?.id === linkedOrderId,
  );

  if (!order) {
    throw new BadRequestException('No se encontro el examen o derivacion estructurada seleccionada');
  }

  return {
    linkedOrderType: linkedOrderTypeRaw as LinkedOrderType,
    linkedOrderId,
    linkedOrderLabel: order.nombre?.trim() || linkedOrderId,
  };
}
