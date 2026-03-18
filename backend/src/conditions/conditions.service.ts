import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConditionsSimilarityService, SuggestionResult } from './conditions-similarity.service';
import { CreateConditionDto } from './dto/create-condition.dto';
import { UpdateConditionDto } from './dto/update-condition.dto';
import { SuggestConditionDto } from './dto/suggest-condition.dto';
import { ChosenMode } from '../common/types';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { CreateLocalConditionDto } from './dto/create-local-condition.dto';
import { UpdateLocalConditionDto } from './dto/update-local-condition.dto';

@Injectable()
export class ConditionsService {
  constructor(
    private prisma: PrismaService,
    private similarityService: ConditionsSimilarityService,
  ) {}

  async create(createDto: CreateConditionDto) {
    const condition = await this.prisma.conditionCatalog.create({
      data: {
        name: createDto.name,
        synonyms: JSON.stringify(createDto.synonyms || []),
        tags: JSON.stringify(createDto.tags || []),
      },
    });

    // Rebuild index with new condition
    await this.similarityService.buildIndex();

    return condition;
  }

  private parseStringArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  private getInstanceId(user: CurrentUserData): string {
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }
    if (user.role === 'MEDICO') return user.id;
    if (user.role === 'ASISTENTE' && user.medicoId) return user.medicoId;
    throw new ForbiddenException('No tiene una instancia asignada');
  }

  private toConditionResponse(
    condition: { id: string; name: string; synonyms?: unknown; tags?: unknown; active: boolean },
    scope: 'GLOBAL' | 'LOCAL',
    baseConditionId?: string | null,
  ) {
    return {
      id: condition.id,
      name: condition.name,
      synonyms: this.parseStringArray(condition.synonyms),
      tags: this.parseStringArray(condition.tags),
      active: condition.active,
      scope,
      baseConditionId: baseConditionId ?? null,
    };
  }

  private async getMergedConditions(user: CurrentUserData, search?: string) {
    const instanceId = this.getInstanceId(user);
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

    const merged: ReturnType<ConditionsService['toConditionResponse']>[] = [];

    for (const condition of globalConditions) {
      const local = localByBase.get(condition.id);
      if (local) {
        if (local.hidden || !local.active) {
          continue;
        }
        merged.push(
          this.toConditionResponse(
            local,
            'LOCAL',
            condition.id,
          )
        );
      } else {
        merged.push(this.toConditionResponse(condition, 'GLOBAL'));
      }
    }

    for (const local of localOnly) {
      if (local.hidden || !local.active) continue;
      merged.push(this.toConditionResponse(local, 'LOCAL'));
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
      return conditions.map((condition) => this.toConditionResponse(condition, 'GLOBAL'));
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
    if (updateDto.name) updateData.name = updateDto.name;
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
    const instanceId = this.getInstanceId(user);

    if (!dto.name || dto.name.trim().length < 2) {
      throw new BadRequestException('El nombre debe tener al menos 2 caracteres');
    }

    if (dto.baseConditionId) {
      const base = await this.prisma.conditionCatalog.findUnique({
        where: { id: dto.baseConditionId },
      });
      if (!base) {
        throw new NotFoundException('Afección base no encontrada');
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
          name: dto.name.trim(),
          synonyms: JSON.stringify(dto.synonyms || []),
          tags: JSON.stringify(dto.tags || []),
          active: true,
          hidden: false,
        },
        update: {
          name: dto.name.trim(),
          synonyms: JSON.stringify(dto.synonyms || []),
          tags: JSON.stringify(dto.tags || []),
          active: true,
          hidden: false,
        },
      });

      return this.toConditionResponse(upserted, 'LOCAL', dto.baseConditionId);
    }

    const created = await this.prisma.conditionCatalogLocal.create({
      data: {
        medicoId: instanceId,
        name: dto.name.trim(),
        synonyms: JSON.stringify(dto.synonyms || []),
        tags: JSON.stringify(dto.tags || []),
      },
    });

    return this.toConditionResponse(created, 'LOCAL');
  }

  async updateLocal(user: CurrentUserData, id: string, dto: UpdateLocalConditionDto) {
    const instanceId = this.getInstanceId(user);
    const existing = await this.prisma.conditionCatalogLocal.findFirst({
      where: { id, medicoId: instanceId },
    });

    if (!existing) {
      throw new NotFoundException('Afección local no encontrada');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name) updateData.name = dto.name.trim();
    if (dto.synonyms) updateData.synonyms = JSON.stringify(dto.synonyms || []);
    if (dto.tags) updateData.tags = JSON.stringify(dto.tags || []);

    const updated = await this.prisma.conditionCatalogLocal.update({
      where: { id },
      data: updateData,
    });

    return this.toConditionResponse(updated, 'LOCAL', updated.baseConditionId ?? null);
  }

  async removeLocal(user: CurrentUserData, id: string) {
    const instanceId = this.getInstanceId(user);
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
    const instanceId = this.getInstanceId(user);
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

  async importGlobalCsv(buffer: Buffer) {
    const content = buffer.toString('utf-8');
    if (!content.trim()) {
      throw new BadRequestException('El CSV esta vacio');
    }

    const lines = content.replace(/\uFEFF/g, '').split(/\r?\n/);
    const names: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (names.length === 0 && line.toLowerCase() === 'name') {
        continue;
      }
      const value = line.replace(/^"|"$/g, '').trim();
      if (value.length === 0) continue;
      names.push(value);
    }

    if (names.length === 0) {
      throw new BadRequestException('No se encontraron nombres en el CSV');
    }

    const uniqueNames = Array.from(
      new Map(names.map((name) => [name.toLowerCase(), name])).values()
    );

    const existing = await this.prisma.conditionCatalog.findMany();
    const existingByName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));

    let created = 0;
    let updated = 0;

    const operations = uniqueNames.map((name) => {
      const existingCondition = existingByName.get(name.toLowerCase());
      if (existingCondition) {
        updated += 1;
        return this.prisma.conditionCatalog.update({
          where: { id: existingCondition.id },
          data: { name, active: true },
        });
      }
      created += 1;
      return this.prisma.conditionCatalog.create({
        data: { name },
      });
    });

    await this.prisma.$transaction(operations);
    await this.similarityService.buildIndex();

    return { created, updated, total: uniqueNames.length };
  }

  async logSuggestion(
    encounterId: string,
    inputText: string,
    suggestions: SuggestionResult[],
    chosenConditionId: string | null,
    chosenMode: 'AUTO' | 'MANUAL',
  ) {
    return this.prisma.conditionSuggestionLog.create({
      data: {
        encounterId,
        inputText,
        topSuggestions: JSON.stringify(suggestions),
        chosenConditionId,
        chosenMode: chosenMode as ChosenMode,
      },
    });
  }

  async saveSuggestionChoice(
    encounterId: string,
    dto: {
      inputText: string;
      suggestions: SuggestionResult[];
      chosenConditionId: string | null;
      chosenMode: 'AUTO' | 'MANUAL';
    },
    user: CurrentUserData,
  ) {
    const instanceId = this.getInstanceId(user);
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
      dto.suggestions,
      dto.chosenConditionId,
      dto.chosenMode,
    );
  }
}
