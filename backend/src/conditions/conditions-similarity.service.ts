import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseJsonArray } from '../common/utils/parse-json-array';
import * as natural from 'natural';

interface ConditionDocument {
  id: string;
  name: string;
  normalizedName: string;
  normalizedSynonyms: string[];
  normalizedTags: string[];
}

export interface SuggestionResult {
  id: string;
  name: string;
  score: number;
  confidence: number;
}

interface ConditionInput {
  id: string;
  name: string;
  synonyms?: string[];
  tags?: string[];
}

@Injectable()
export class ConditionsSimilarityService implements OnModuleInit {
  private tfidf: natural.TfIdf;
  private documents: ConditionDocument[] = [];
  private initialized = false;

  constructor(private prisma: PrismaService) {
    this.tfidf = new natural.TfIdf();
  }

  async onModuleInit() {
    await this.buildIndex();
  }

  async buildIndex() {
    const conditions = await this.prisma.conditionCatalog.findMany({
      where: { active: true },
    });

    this.tfidf = new natural.TfIdf();
    this.documents = [];

    for (const condition of conditions) {
      const document = this.buildDocument({
        id: condition.id,
        name: condition.name,
        synonyms: parseJsonArray(condition.synonyms),
        tags: parseJsonArray(condition.tags),
      });

      this.documents.push(document);
      this.tfidf.addDocument(this.buildWeightedSearchText(document));
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

    return this.rankDocuments(this.tfidf, this.documents, inputText, limit);
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

    const tfidf = new natural.TfIdf();
    const documents = conditions.map((condition) => {
      const document = this.buildDocument(condition);
      tfidf.addDocument(this.buildWeightedSearchText(document));
      return document;
    });

    return this.rankDocuments(tfidf, documents, inputText, limit);
  }

  private buildDocument(condition: ConditionInput): ConditionDocument {
    return {
      id: condition.id,
      name: condition.name,
      normalizedName: this.normalizeText(condition.name),
      normalizedSynonyms: (condition.synonyms ?? []).map((term) => this.normalizeText(term)).filter(Boolean),
      normalizedTags: (condition.tags ?? []).map((term) => this.normalizeText(term)).filter(Boolean),
    };
  }

  private buildWeightedSearchText(document: ConditionDocument) {
    return [
      document.normalizedName,
      document.normalizedName,
      ...document.normalizedSynonyms,
      ...document.normalizedSynonyms,
      ...document.normalizedTags,
    ].join(' ');
  }

  private rankDocuments(
    tfidf: natural.TfIdf,
    documents: ConditionDocument[],
    inputText: string,
    limit: number,
  ): Promise<SuggestionResult[]> {
    const normalizedInput = this.normalizeText(inputText);
    if (!normalizedInput) {
      return Promise.resolve([]);
    }

    const inputTokens = this.tokenize(normalizedInput);
    const scores = documents
      .map((document, index) => ({
        document,
        score: this.scoreDocument(tfidf, index, document, normalizedInput, inputTokens),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);

    const maxScore = scores[0]?.score || 1;

    return Promise.resolve(
      scores.map(({ document, score }) => ({
        id: document.id,
        name: document.name,
        score,
        confidence: Math.max(1, Math.min(Math.round((score / maxScore) * 100), 99)),
      })),
    );
  }

  private scoreDocument(
    tfidf: natural.TfIdf,
    index: number,
    document: ConditionDocument,
    normalizedInput: string,
    inputTokens: string[],
  ) {
    let score = 0;

    tfidf.tfidfs(normalizedInput, (documentIndex, measure) => {
      if (documentIndex === index) {
        score = measure;
      }
    });

    score += this.scoreTerm(document.normalizedName, normalizedInput, inputTokens, {
      exact: 10,
      contains: 5,
      overlap: 4,
      allTokens: 3,
    });
    score += this.scoreBestTerm(document.normalizedSynonyms, normalizedInput, inputTokens, {
      exact: 8,
      contains: 4,
      overlap: 3,
      allTokens: 2,
    });
    score += this.scoreBestTerm(document.normalizedTags, normalizedInput, inputTokens, {
      exact: 4,
      contains: 2,
      overlap: 1.5,
      allTokens: 1,
    });

    return score;
  }

  private scoreBestTerm(
    terms: string[],
    normalizedInput: string,
    inputTokens: string[],
    weights: { exact: number; contains: number; overlap: number; allTokens: number },
  ) {
    return terms.reduce(
      (bestScore, term) => Math.max(bestScore, this.scoreTerm(term, normalizedInput, inputTokens, weights)),
      0,
    );
  }

  private scoreTerm(
    term: string,
    normalizedInput: string,
    inputTokens: string[],
    weights: { exact: number; contains: number; overlap: number; allTokens: number },
  ) {
    if (!term) {
      return 0;
    }

    const termTokens = this.tokenize(term);
    let score = 0;

    if (term === normalizedInput) {
      score += weights.exact;
    } else if (term.includes(normalizedInput) || normalizedInput.includes(term)) {
      score += weights.contains;
    }

    const sharedTokens = inputTokens.filter((token) => termTokens.includes(token)).length;
    if (sharedTokens > 0) {
      score += (sharedTokens / Math.max(inputTokens.length, termTokens.length)) * weights.overlap;
    }

    if (inputTokens.length > 1 && inputTokens.every((token) => termTokens.includes(token))) {
      score += weights.allTokens;
    }

    return score;
  }

  private tokenize(text: string) {
    return text.split(/\s+/).filter(Boolean);
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ')
      .trim();
  }
}
