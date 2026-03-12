import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
export declare class ConditionsSimilarityService implements OnModuleInit {
    private prisma;
    private tfidf;
    private documents;
    private initialized;
    constructor(prisma: PrismaService);
    onModuleInit(): Promise<void>;
    buildIndex(): Promise<void>;
    suggest(inputText: string, limit?: number): Promise<SuggestionResult[]>;
    suggestFromConditions(conditions: ConditionInput[], inputText: string, limit?: number): Promise<SuggestionResult[]>;
    private normalizeText;
}
export {};
