import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseStringArray } from '../conditions/conditions-helpers';
import { ConditionsTfIdf } from './conditions-tfidf';
import { buildDocument, buildWeightedSearchText, rankDocuments } from './conditions-similarity.helpers';
import type { ConditionInput, SuggestionResult } from './conditions-similarity.types';

export type { SuggestionReason, SuggestionResult } from './conditions-similarity.types';

@Injectable()
export class ConditionsSimilarityService implements OnModuleInit {
  private tfidf: ConditionsTfIdf;
  private documents: Array<{
    id: string;
    name: string;
    normalizedName: string;
    synonyms: Array<{ raw: string; normalized: string }>;
    tags: Array<{ raw: string; normalized: string }>;
  }> = [];
  private initialized = false;

  constructor(private prisma: PrismaService) {
    this.tfidf = new ConditionsTfIdf();
  }

  async onModuleInit() {
    await this.buildIndex();
  }

  async buildIndex() {
    const conditions = await this.prisma.conditionCatalog.findMany({
      where: { active: true },
    });

    this.tfidf = new ConditionsTfIdf();
    this.documents = [];

    for (const condition of conditions) {
      const document = buildDocument({
        id: condition.id,
        name: condition.name,
        synonyms: parseStringArray(condition.synonyms),
        tags: parseStringArray(condition.tags),
      });

      this.documents.push(document);
      this.tfidf.addDocument(buildWeightedSearchText(document));
    }

    this.initialized = true;
  }

  async suggest(inputText: string, limit = 3): Promise<SuggestionResult[]> {
    if (!this.initialized || this.documents.length === 0) {
      await this.buildIndex();
    }

    if (!inputText || inputText.trim().length === 0) {
      return [];
    }

    return rankDocuments(this.tfidf, this.documents, inputText, limit);
  }

  async suggestFromConditions(
    conditions: ConditionInput[],
    inputText: string,
    limit = 3,
  ): Promise<SuggestionResult[]> {
    if (!conditions || conditions.length === 0) {
      return [];
    }

    if (!inputText || inputText.trim().length === 0) {
      return [];
    }

    const tfidf = new ConditionsTfIdf();
    const documents = conditions.map((condition) => {
      const document = buildDocument(condition);
      tfidf.addDocument(buildWeightedSearchText(document));
      return document;
    });

    return rankDocuments(tfidf, documents, inputText, limit);
  }
}
