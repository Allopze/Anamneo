import { BadRequestException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConditionsSimilarityService, SuggestionResult } from './conditions-similarity.service';
import { CreateConditionDto } from './dto/create-condition.dto';
import { UpdateConditionDto } from './dto/update-condition.dto';
import { SuggestConditionDto } from './dto/suggest-condition.dto';
import { ChosenMode } from '../common/types';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { CreateLocalConditionDto } from './dto/create-local-condition.dto';
import { UpdateLocalConditionDto } from './dto/update-local-condition.dto';
import {
  buildSuggestionLogMetadata,
  CONDITION_SUGGESTION_RANKING_VERSION,
} from './conditions-suggestion-log';
import { validateSuggestionChoicePayload } from './conditions-suggestion-choice';
import {
  normalizeConditionName,
  sanitizeStringArray,
  mergeUniqueStrings,
  parseStringArray,
  toConditionResponse,
  getInstanceId,
} from './conditions-helpers';

@Injectable()
export class ConditionsService {
  constructor(
    private prisma: PrismaService,
    private similarityService: ConditionsSimilarityService,
  ) {}

  private async findLocalConditionDuplicates(instanceId: string, name: string, excludeId?: string) {
    const normalizedName = normalizeConditionName(name);
    const localConditions = await this.prisma.conditionCatalogLocal.findMany({
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

  async create(createDto: CreateConditionDto) {
    const normalizedName = normalizeConditionName(createDto.name);
    const existing = await this.prisma.conditionCatalog.findFirst({
      where: { normalizedName },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Ya existe una afección global con ese nombre');
    }

    const condition = await this.prisma.conditionCatalog.create({
      data: {
        name: createDto.name,
        normalizedName,
        synonyms: JSON.stringify(createDto.synonyms || []),
        tags: JSON.stringify(createDto.tags || []),
      },
    });

    // Rebuild index with new condition
    await this.similarityService.buildIndex();

    return condition;
  }

  private async getMergedConditions(user: CurrentUserData, search?: string) {
    const instanceId = getInstanceId(user);
    const searchLower = search?.trim().toLowerCase();

    const [globalConditions, localConditions] = await Promise.all([
      this.prisma.conditionCatalog.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.conditionCatalogLocal.findMany({
        where: { medicoId: instanceId },
        orderBy: { name: 'asc' },
      }),
    ]);

    const localByBase = new Map<string, typeof localConditions[number]>();
    const localOnly: typeof localConditions[number][] = [];

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
          )
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

  async findAll(search: string | undefined, user: CurrentUserData) {
    if (user?.isAdmin) {
      const where = search ? { name: { contains: search } } : {};
      const conditions = await this.prisma.conditionCatalog.findMany({
        where,
        orderBy: { name: 'asc' },
      });
      return conditions.map((condition) => toConditionResponse(condition, 'GLOBAL'));
    }

    return this.getMergedConditions(user, search);
  }

  async findById(id: string) {
    const condition = await this.prisma.conditionCatalog.findUnique({
      where: { id },
    });

    if (!condition) {
      throw new NotFoundException('Afección no encontrada');
    }

    return condition;
  }

  async update(id: string, updateDto: UpdateConditionDto) {
    const condition = await this.prisma.conditionCatalog.findUnique({
      where: { id },
    });

    if (!condition) {
      throw new NotFoundException('Afección no encontrada');
    }

    const updateData: Record<string, unknown> = {};
    if (updateDto.name) {
      const normalizedName = normalizeConditionName(updateDto.name);
      const existing = await this.prisma.conditionCatalog.findFirst({
        where: {
          normalizedName,
          id: { not: id },
        },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException('Ya existe una afección global con ese nombre');
      }
      updateData.name = updateDto.name;
      updateData.normalizedName = normalizedName;
    }
    if (updateDto.synonyms) updateData.synonyms = JSON.stringify(updateDto.synonyms);
    if (updateDto.tags) updateData.tags = JSON.stringify(updateDto.tags);
    if (updateDto.active !== undefined) updateData.active = updateDto.active;

    const updated = await this.prisma.conditionCatalog.update({
      where: { id },
      data: updateData,
    });

    // Rebuild index
    await this.similarityService.buildIndex();

    return updated;
  }

  async remove(id: string) {
    const condition = await this.prisma.conditionCatalog.findUnique({
      where: { id },
    });

    if (!condition) {
      throw new NotFoundException('Afección no encontrada');
    }

    // Soft delete
    await this.prisma.conditionCatalog.update({
      where: { id },
      data: { active: false },
    });

    await this.similarityService.buildIndex();

    return { message: 'Afección eliminada correctamente' };
  }

  async suggest(user: CurrentUserData, dto: SuggestConditionDto): Promise<SuggestionResult[]> {
    if (user?.isAdmin) {
      return this.similarityService.suggest(dto.text, dto.limit || 3);
    }

    const conditions = await this.getMergedConditions(user);
    return this.similarityService.suggestFromConditions(conditions, dto.text, dto.limit || 3);
  }

  async createLocal(user: CurrentUserData, dto: CreateLocalConditionDto) {
    const instanceId = getInstanceId(user);
    const trimmedName = dto.name?.trim();
    const sanitizedSynonyms = sanitizeStringArray(dto.synonyms);
    const sanitizedTags = sanitizeStringArray(dto.tags);

    if (!trimmedName || trimmedName.length < 2) {
      throw new BadRequestException('El nombre debe tener al menos 2 caracteres');
    }

    const duplicateByName = await this.findLocalConditionDuplicates(instanceId, trimmedName);
    const existingByName = duplicateByName[0];

    if (dto.baseConditionId) {
      const base = await this.prisma.conditionCatalog.findUnique({
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
        const updated = await this.prisma.conditionCatalogLocal.update({
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

      const upserted = await this.prisma.conditionCatalogLocal.upsert({
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
      const updated = await this.prisma.conditionCatalogLocal.update({
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

    const created = await this.prisma.conditionCatalogLocal.create({
      data: {
        medicoId: instanceId,
        name: trimmedName,
        synonyms: JSON.stringify(sanitizedSynonyms),
        tags: JSON.stringify(sanitizedTags),
      },
    });

    return toConditionResponse(created, 'LOCAL');
  }

  async updateLocal(user: CurrentUserData, id: string, dto: UpdateLocalConditionDto) {
    const instanceId = getInstanceId(user);
    const existing = await this.prisma.conditionCatalogLocal.findFirst({
      where: { id, medicoId: instanceId },
    });

    if (!existing) {
      throw new NotFoundException('Afección local no encontrada');
    }

    const nextName = dto.name?.trim() || existing.name;
    const duplicateByName = await this.findLocalConditionDuplicates(instanceId, nextName, id);
    if (duplicateByName.length > 0) {
      throw new BadRequestException('Ya existe una afección local con ese nombre en el catálogo');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name) updateData.name = dto.name.trim();
    if (dto.synonyms) updateData.synonyms = JSON.stringify(sanitizeStringArray(dto.synonyms));
    if (dto.tags) updateData.tags = JSON.stringify(sanitizeStringArray(dto.tags));

    const updated = await this.prisma.conditionCatalogLocal.update({
      where: { id },
      data: updateData,
    });

    return toConditionResponse(updated, 'LOCAL', updated.baseConditionId ?? null);
  }

  async removeLocal(user: CurrentUserData, id: string) {
    const instanceId = getInstanceId(user);
    const existing = await this.prisma.conditionCatalogLocal.findFirst({
      where: { id, medicoId: instanceId },
    });

    if (!existing) {
      throw new NotFoundException('Afección local no encontrada');
    }

    if (existing.baseConditionId) {
      await this.prisma.conditionCatalogLocal.update({
        where: { id },
        data: { hidden: true, active: false },
      });
    } else {
      await this.prisma.conditionCatalogLocal.update({
        where: { id },
        data: { active: false },
      });
    }

    return { message: 'Afección eliminada de la instancia' };
  }

  async hideBaseCondition(user: CurrentUserData, baseConditionId: string) {
    const instanceId = getInstanceId(user);
    const base = await this.prisma.conditionCatalog.findUnique({
      where: { id: baseConditionId },
    });

    if (!base) {
      throw new NotFoundException('Afección base no encontrada');
    }

    const override = await this.prisma.conditionCatalogLocal.upsert({
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

  async logSuggestion(
    encounterId: string,
    inputText: string,
    persistedTextSnapshot: string | undefined,
    suggestions: SuggestionResult[],
    chosenConditionId: string | null,
    chosenMode: 'AUTO' | 'MANUAL',
  ) {
    return this.prisma.conditionSuggestionLog.create({
      data: {
        encounterId,
        inputText,
        persistedTextSnapshot: persistedTextSnapshot?.trim() || null,
        topSuggestions: JSON.stringify(suggestions),
        rankingVersion: CONDITION_SUGGESTION_RANKING_VERSION,
        rankingMetadata: buildSuggestionLogMetadata(suggestions, chosenConditionId),
        chosenConditionId,
        chosenMode: chosenMode as ChosenMode,
      },
    });
  }

  async saveSuggestionChoice(
    encounterId: string,
    dto: {
      inputText: string;
      persistedTextSnapshot?: string;
      suggestions: SuggestionResult[];
      chosenConditionId: string | null;
      chosenMode: 'AUTO' | 'MANUAL';
    },
    user: CurrentUserData,
  ) {
    validateSuggestionChoicePayload(dto);

    const instanceId = getInstanceId(user);
    const encounter = await this.prisma.encounter.findFirst({
      where: {
        id: encounterId,
        medicoId: instanceId,
      },
      select: { id: true },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    return this.logSuggestion(
      encounterId,
      dto.inputText,
      dto.persistedTextSnapshot,
      dto.suggestions,
      dto.chosenConditionId,
      dto.chosenMode,
    );
  }
}
