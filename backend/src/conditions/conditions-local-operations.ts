import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import type { PrismaService } from '../prisma/prisma.service';
import type { CreateLocalConditionDto } from './dto/create-local-condition.dto';
import type { UpdateLocalConditionDto } from './dto/update-local-condition.dto';
import {
  getInstanceId,
  mergeUniqueStrings,
  normalizeConditionName,
  parseStringArray,
  sanitizeStringArray,
  toConditionResponse,
} from './conditions-helpers';

async function findLocalConditionDuplicates(prisma: PrismaService, instanceId: string, name: string, excludeId?: string) {
  const normalizedName = normalizeConditionName(name);
  const localConditions = await prisma.conditionCatalogLocal.findMany({
    where: { medicoId: instanceId },
    orderBy: [{ active: 'desc' }, { hidden: 'asc' }, { createdAt: 'asc' }],
  });

  return localConditions.filter((condition) => {
    if (excludeId && condition.id === excludeId) {
      return false;
    }

    return normalizeConditionName(condition.name) === normalizedName;
  });
}

export async function createLocalCondition(
  prisma: PrismaService,
  user: CurrentUserData,
  dto: CreateLocalConditionDto,
) {
  const instanceId = getInstanceId(user);
  const trimmedName = dto.name?.trim();
  const sanitizedSynonyms = sanitizeStringArray(dto.synonyms);
  const sanitizedTags = sanitizeStringArray(dto.tags);

  if (!trimmedName || trimmedName.length < 2) {
    throw new BadRequestException('El nombre debe tener al menos 2 caracteres');
  }

  const duplicateByName = await findLocalConditionDuplicates(prisma, instanceId, trimmedName);
  const existingByName = duplicateByName[0];

  if (dto.baseConditionId) {
    const base = await prisma.conditionCatalog.findUnique({
      where: { id: dto.baseConditionId },
    });
    if (!base) {
      throw new NotFoundException('Afección base no encontrada');
    }

    if (
      existingByName
      && existingByName.baseConditionId
      && existingByName.baseConditionId !== dto.baseConditionId
    ) {
      throw new BadRequestException('Ya existe una afección local con ese nombre en el catálogo');
    }

    if (existingByName) {
      const updated = await prisma.conditionCatalogLocal.update({
        where: { id: existingByName.id },
        data: {
          baseConditionId: dto.baseConditionId,
          name: trimmedName,
          synonyms: JSON.stringify(
            mergeUniqueStrings(
              parseStringArray(existingByName.synonyms),
              sanitizedSynonyms,
            ),
          ),
          tags: JSON.stringify(
            mergeUniqueStrings(
              parseStringArray(existingByName.tags),
              sanitizedTags,
            ),
          ),
          active: true,
          hidden: false,
        },
      });

      return {
        ...toConditionResponse(updated, 'LOCAL', dto.baseConditionId),
        deduplicatedByName: true,
      };
    }

    const upserted = await prisma.conditionCatalogLocal.upsert({
      where: {
        medicoId_baseConditionId: {
          medicoId: instanceId,
          baseConditionId: dto.baseConditionId,
        },
      },
      create: {
        medicoId: instanceId,
        baseConditionId: dto.baseConditionId,
        name: trimmedName,
        synonyms: JSON.stringify(sanitizedSynonyms),
        tags: JSON.stringify(sanitizedTags),
        active: true,
        hidden: false,
      },
      update: {
        name: trimmedName,
        synonyms: JSON.stringify(sanitizedSynonyms),
        tags: JSON.stringify(sanitizedTags),
        active: true,
        hidden: false,
      },
    });

    return toConditionResponse(upserted, 'LOCAL', dto.baseConditionId);
  }

  if (existingByName) {
    const updated = await prisma.conditionCatalogLocal.update({
      where: { id: existingByName.id },
      data: {
        name: trimmedName,
        synonyms: JSON.stringify(
          mergeUniqueStrings(
            parseStringArray(existingByName.synonyms),
            sanitizedSynonyms,
          ),
        ),
        tags: JSON.stringify(
          mergeUniqueStrings(
            parseStringArray(existingByName.tags),
            sanitizedTags,
          ),
        ),
        active: true,
        hidden: false,
      },
    });

    return {
      ...toConditionResponse(updated, 'LOCAL', updated.baseConditionId ?? null),
      deduplicatedByName: true,
    };
  }

  const created = await prisma.conditionCatalogLocal.create({
    data: {
      medicoId: instanceId,
      name: trimmedName,
      synonyms: JSON.stringify(sanitizedSynonyms),
      tags: JSON.stringify(sanitizedTags),
    },
  });

  return toConditionResponse(created, 'LOCAL');
}

export async function updateLocalCondition(
  prisma: PrismaService,
  user: CurrentUserData,
  id: string,
  dto: UpdateLocalConditionDto,
) {
  const instanceId = getInstanceId(user);
  const existing = await prisma.conditionCatalogLocal.findFirst({
    where: { id, medicoId: instanceId },
  });

  if (!existing) {
    throw new NotFoundException('Afección local no encontrada');
  }

  const nextName = dto.name?.trim() || existing.name;
  const duplicateByName = await findLocalConditionDuplicates(prisma, instanceId, nextName, id);
  if (duplicateByName.length > 0) {
    throw new BadRequestException('Ya existe una afección local con ese nombre en el catálogo');
  }

  const updateData: Record<string, unknown> = {};
  if (dto.name) updateData.name = dto.name.trim();
  if (dto.synonyms) updateData.synonyms = JSON.stringify(sanitizeStringArray(dto.synonyms));
  if (dto.tags) updateData.tags = JSON.stringify(sanitizeStringArray(dto.tags));

  const updated = await prisma.conditionCatalogLocal.update({
    where: { id },
    data: updateData,
  });

  return toConditionResponse(updated, 'LOCAL', updated.baseConditionId ?? null);
}

export async function removeLocalCondition(prisma: PrismaService, user: CurrentUserData, id: string) {
  const instanceId = getInstanceId(user);
  const existing = await prisma.conditionCatalogLocal.findFirst({
    where: { id, medicoId: instanceId },
  });

  if (!existing) {
    throw new NotFoundException('Afección local no encontrada');
  }

  if (existing.baseConditionId) {
    await prisma.conditionCatalogLocal.update({
      where: { id },
      data: { hidden: true, active: false },
    });
  } else {
    await prisma.conditionCatalogLocal.update({
      where: { id },
      data: { active: false },
    });
  }

  return { message: 'Afección eliminada de la instancia' };
}

export async function hideBaseCondition(prisma: PrismaService, user: CurrentUserData, baseConditionId: string) {
  const instanceId = getInstanceId(user);
  const base = await prisma.conditionCatalog.findUnique({
    where: { id: baseConditionId },
  });

  if (!base) {
    throw new NotFoundException('Afección base no encontrada');
  }

  const override = await prisma.conditionCatalogLocal.upsert({
    where: {
      medicoId_baseConditionId: {
        medicoId: instanceId,
        baseConditionId,
      },
    },
    create: {
      medicoId: instanceId,
      baseConditionId,
      name: base.name,
      synonyms: base.synonyms,
      tags: base.tags,
      active: false,
      hidden: true,
    },
    update: {
      active: false,
      hidden: true,
    },
  });

  return { message: 'Afección ocultada en la instancia', id: override.id };
}