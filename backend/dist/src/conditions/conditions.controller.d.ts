import { ConditionsService } from './conditions.service';
import { CreateConditionDto } from './dto/create-condition.dto';
import { UpdateConditionDto } from './dto/update-condition.dto';
import { SuggestConditionDto } from './dto/suggest-condition.dto';
import { SaveSuggestionDto } from './dto/save-suggestion.dto';
import { CreateLocalConditionDto } from './dto/create-local-condition.dto';
import { UpdateLocalConditionDto } from './dto/update-local-condition.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
export declare class ConditionsController {
    private readonly conditionsService;
    constructor(conditionsService: ConditionsService);
    create(createDto: CreateConditionDto): Promise<{
        id: string;
        name: string;
        synonyms: string;
        tags: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    importCsv(file?: Express.Multer.File): Promise<{
        created: number;
        updated: number;
        total: number;
    }>;
    findAll(search: string | undefined, user: CurrentUserData): Promise<{
        id: string;
        name: string;
        synonyms: string[];
        tags: string[];
        active: boolean;
        scope: "GLOBAL" | "LOCAL";
        baseConditionId: string | null;
    }[]>;
    findOne(id: string): Promise<{
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
    suggest(suggestDto: SuggestConditionDto, user: CurrentUserData): Promise<import("./conditions-similarity.service").SuggestionResult[]>;
    createLocal(user: CurrentUserData, createDto: CreateLocalConditionDto): Promise<{
        id: string;
        name: string;
        synonyms: string[];
        tags: string[];
        active: boolean;
        scope: "GLOBAL" | "LOCAL";
        baseConditionId: string | null;
    }>;
    updateLocal(user: CurrentUserData, id: string, updateDto: UpdateLocalConditionDto): Promise<{
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
    hideBaseCondition(user: CurrentUserData, baseId: string): Promise<{
        message: string;
        id: string;
    }>;
    saveSuggestion(encounterId: string, dto: SaveSuggestionDto, user: CurrentUserData): Promise<{
        id: string;
        createdAt: Date;
        encounterId: string;
        inputText: string;
        topSuggestions: string;
        chosenConditionId: string | null;
        chosenMode: string;
    }>;
}
