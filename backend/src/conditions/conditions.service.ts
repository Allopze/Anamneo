import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
import { countMergedConditions, getMergedConditions } from './conditions-local-queries';
import { createLocalCondition, updateLocalCondition, removeLocalCondition, hideBaseCondition } from './conditions-local-operations';
import { getInstanceId, normalizeConditionName, toConditionResponse } from './conditions-helpers';

@Injectable()
export class ConditionsService {
  constructor(
    private prisma: PrismaService,
    private similarityService: ConditionsSimilarityService,
  ) {}

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

  async findAll(search: string | undefined, user: CurrentUserData) {
    if (user?.isAdmin) {
      const where = search ? { name: { contains: search } } : {};
      const conditions = await this.prisma.conditionCatalog.findMany({
        where,
        orderBy: { name: 'asc' },
      });
      return conditions.map((condition) => toConditionResponse(condition, 'GLOBAL'));
    }

    return getMergedConditions(this.prisma, user, search);
  }

  async count(user: CurrentUserData) {
    if (user?.isAdmin) {
      const count = await this.prisma.conditionCatalog.count();
      return { count };
    }

    const count = await countMergedConditions(this.prisma, user);
    return { count };
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

    const conditions = await getMergedConditions(this.prisma, user);
    return this.similarityService.suggestFromConditions(conditions, dto.text, dto.limit || 3);
  }

  async createLocal(user: CurrentUserData, dto: CreateLocalConditionDto) {
    return createLocalCondition(this.prisma, user, dto);
  }

  async updateLocal(user: CurrentUserData, id: string, dto: UpdateLocalConditionDto) {
    return updateLocalCondition(this.prisma, user, id, dto);
  }

  async removeLocal(user: CurrentUserData, id: string) {
    return removeLocalCondition(this.prisma, user, id);
  }

  async hideBaseCondition(user: CurrentUserData, baseConditionId: string) {
    return hideBaseCondition(this.prisma, user, baseConditionId);
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
