import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseJsonArray } from '../common/utils/parse-json-array';
import * as natural from 'natural';

interface ConditionDocument {
  id: string;
  name: string;
  terms: string[];
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
      // Parse JSON strings (stored as strings in DB)
      const synonyms = parseJsonArray(condition.synonyms);
      const tags = parseJsonArray(condition.tags);

      // Combine name, synonyms, and tags into searchable terms
      const terms = [
        condition.name.toLowerCase(),
        ...synonyms.map((s) => s.toLowerCase()),
        ...tags.map((t) => t.toLowerCase()),
      ];

      const document: ConditionDocument = {
        id: condition.id,
        name: condition.name,
        terms,
      };

      this.documents.push(document);
      this.tfidf.addDocument(terms.join(' '));
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

    // Normalize input
    const normalizedInput = this.normalizeText(inputText);

    // Calculate scores for each document
    const scores: { index: number; score: number }[] = [];

    this.documents.forEach((_, index) => {
      let score = 0;
      this.tfidf.tfidfs(normalizedInput, (i, measure) => {
        if (i === index) {
          score = measure;
        }
      });

      // Also check for exact/partial matches in terms
      const doc = this.documents[index];
      const inputWords = normalizedInput.split(/\s+/);

      for (const word of inputWords) {
        for (const term of doc.terms) {
          if (term.includes(word) || word.includes(term)) {
            score += 0.5; // Bonus for partial matches
          }
          if (term === word) {
            score += 1; // Extra bonus for exact matches
          }
        }
      }

      if (score > 0) {
        scores.push({ index, score });
      }
    });

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Get top results
    const topScores = scores.slice(0, limit);

    // Calculate confidence (normalize scores to 0-100%)
    const maxScore = topScores[0]?.score || 1;

    return topScores.map((s) => ({
      id: this.documents[s.index].id,
      name: this.documents[s.index].name,
      score: s.score,
      confidence: Math.min(Math.round((s.score / maxScore) * 100), 99),
    }));
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
    const documents: ConditionDocument[] = [];

    for (const condition of conditions) {
      const synonyms = condition.synonyms ?? [];
      const tags = condition.tags ?? [];

      const terms = [
        condition.name.toLowerCase(),
        ...synonyms.map((s) => s.toLowerCase()),
        ...tags.map((t) => t.toLowerCase()),
      ];

      documents.push({
        id: condition.id,
        name: condition.name,
        terms,
      });

      tfidf.addDocument(terms.join(' '));
    }

    const normalizedInput = this.normalizeText(inputText);
    const scores: { index: number; score: number }[] = [];

    documents.forEach((_, index) => {
      let score = 0;
      tfidf.tfidfs(normalizedInput, (i, measure) => {
        if (i === index) {
          score = measure;
        }
      });

      const doc = documents[index];
      const inputWords = normalizedInput.split(/\s+/);

      for (const word of inputWords) {
        for (const term of doc.terms) {
          if (term.includes(word) || word.includes(term)) {
            score += 0.5;
          }
          if (term === word) {
            score += 1;
          }
        }
      }

      if (score > 0) {
        scores.push({ index, score });
      }
    });

    scores.sort((a, b) => b.score - a.score);
    const topScores = scores.slice(0, limit);
    const maxScore = topScores[0]?.score || 1;

    return topScores.map((s) => ({
      id: documents[s.index].id,
      name: documents[s.index].name,
      score: s.score,
      confidence: Math.min(Math.round((s.score / maxScore) * 100), 99),
    }));
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
