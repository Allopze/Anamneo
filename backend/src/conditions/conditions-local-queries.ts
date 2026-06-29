import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import type { PrismaService } from '../prisma/prisma.service';
import { getInstanceId, toConditionResponse } from './conditions-helpers';

export async function getMergedConditions(prisma: PrismaService, user: CurrentUserData, search?: string) {
  const instanceId = getInstanceId(user);
  const searchLower = search?.trim().toLowerCase();

  const globalConditions = await prisma.conditionCatalog.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });
  const localConditions = await prisma.conditionCatalogLocal.findMany({
    where: { medicoId: instanceId },
    orderBy: { name: 'asc' },
  });

  const localByBase = new Map<string, (typeof localConditions)[number]>();
  const localOnly: typeof localConditions = [];

  for (const local of localConditions) {
    if (local.baseConditionId) {
      localByBase.set(local.baseConditionId, local);
    } else {
      localOnly.push(local);
    }
  }

  const merged: ReturnType<typeof toConditionResponse>[] = [];

  for (const condition of globalConditions) {
    const local = localByBase.get(condition.id);
    if (local) {
      if (local.hidden || !local.active) {
        continue;
      }
      merged.push(
        toConditionResponse(
          local,
          'LOCAL',
          condition.id,
        ),
      );
    } else {
      merged.push(toConditionResponse(condition, 'GLOBAL'));
    }
  }

  for (const local of localOnly) {
    if (local.hidden || !local.active) continue;
    merged.push(toConditionResponse(local, 'LOCAL'));
  }

  const filtered = searchLower
    ? merged.filter((item) => item.name.toLowerCase().includes(searchLower))
    : merged;

  return filtered.sort((a, b) => a.name.localeCompare(b.name));
}

export async function countMergedConditions(prisma: PrismaService, user: CurrentUserData) {
  const instanceId = getInstanceId(user);

  const [globalActiveCount, excludedGlobalOverrides, localOnlyCount] = await Promise.all([
    prisma.conditionCatalog.count({ where: { active: true } }),
    prisma.conditionCatalogLocal.count({
      where: {
        medicoId: instanceId,
        baseConditionId: { not: null },
        OR: [{ hidden: true }, { active: false }],
        baseCondition: { is: { active: true } },
      },
    }),
    prisma.conditionCatalogLocal.count({
      where: {
        medicoId: instanceId,
        baseConditionId: null,
        active: true,
        hidden: false,
      },
    }),
  ]);

  return globalActiveCount - excludedGlobalOverrides + localOnlyCount;
}
