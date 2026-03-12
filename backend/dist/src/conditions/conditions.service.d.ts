import { PrismaService } from '../prisma/prisma.service';
import { ConditionsSimilarityService, SuggestionResult } from './conditions-similarity.service';
import { CreateConditionDto } from './dto/create-condition.dto';
import { UpdateConditionDto } from './dto/update-condition.dto';
import { SuggestConditionDto } from './dto/suggest-condition.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { CreateLocalConditionDto } from './dto/create-local-condition.dto';
import { UpdateLocalConditionDto } from './dto/update-local-condition.dto';
export declare class ConditionsService {
    private prisma;
    private similarityService;
    constructor(prisma: PrismaService, similarityService: ConditionsSimilarityService);
    create(createDto: CreateConditionDto): Promise<{
        id: string;
        name: string;
        synonyms: string;
        tags: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    private parseStringArray;
    private getInstanceId;
    private toConditionResponse;
    private getMergedConditions;
    findAll(search: string | undefined, user: CurrentUserData): Promise<{
        id: string;
        name: string;
        synonyms: string[];
        tags: string[];
        active: boolean;
        scope: "GLOBAL" | "LOCAL";
        baseConditionId: string | null;
    }[]>;
    findById(id: string): Promise<{
        id: string;
        name: string;
        synonyms: string;
        tags: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(id: string, updateDto: UpdateConditionDto): Promise<{
        id: string;
        name: string;
        synonyms: string;
        tags: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(id: string): Promise<{
        message: string;
    }>;
    suggest(user: CurrentUserData, dto: SuggestConditionDto): Promise<SuggestionResult[]>;
    createLocal(user: CurrentUserData, dto: CreateLocalConditionDto): Promise<{
        id: string;
        name: string;
        synonyms: string[];
        tags: string[];
        active: boolean;
        scope: "GLOBAL" | "LOCAL";
        baseConditionId: string | null;
    }>;
    updateLocal(user: CurrentUserData, id: string, dto: UpdateLocalConditionDto): Promise<{
        id: string;
        name: string;
        synonyms: string[];
        tags: string[];
        active: boolean;
        scope: "GLOBAL" | "LOCAL";
        baseConditionId: string | null;
    }>;
    removeLocal(user: CurrentUserData, id: string): Promise<{
        message: string;
    }>;
    hideBaseCondition(user: CurrentUserData, baseConditionId: string): Promise<{
        message: string;
        id: string;
    }>;
    importGlobalCsv(buffer: Buffer): Promise<{
        created: number;
        updated: number;
        total: number;
    }>;
    logSuggestion(encounterId: string, inputText: string, suggestions: SuggestionResult[], chosenConditionId: string | null, chosenMode: 'AUTO' | 'MANUAL'): Promise<{
        id: string;
        createdAt: Date;
        encounterId: string;
        inputText: string;
        topSuggestions: string;
        chosenConditionId: string | null;
        chosenMode: string;
    }>;
    saveSuggestionChoice(encounterId: string, dto: {
        inputText: string;
        suggestions: SuggestionResult[];
        chosenConditionId: string | null;
        chosenMode: 'AUTO' | 'MANUAL';
    }, user: CurrentUserData): Promise<{
        id: string;
        createdAt: Date;
        encounterId: string;
        inputText: string;
        topSuggestions: string;
        chosenConditionId: string | null;
        chosenMode: string;
    }>;
}
