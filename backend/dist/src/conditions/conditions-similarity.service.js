"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConditionsSimilarityService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const parse_json_array_1 = require("../common/utils/parse-json-array");
const natural = require("natural");
let ConditionsSimilarityService = class ConditionsSimilarityService {
    constructor(prisma) {
        this.prisma = prisma;
        this.documents = [];
        this.initialized = false;
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
            const synonyms = (0, parse_json_array_1.parseJsonArray)(condition.synonyms);
            const tags = (0, parse_json_array_1.parseJsonArray)(condition.tags);
            const terms = [
                condition.name.toLowerCase(),
                ...synonyms.map((s) => s.toLowerCase()),
                ...tags.map((t) => t.toLowerCase()),
            ];
            const document = {
                id: condition.id,
                name: condition.name,
                terms,
            };
            this.documents.push(document);
            this.tfidf.addDocument(terms.join(' '));
        }
        this.initialized = true;
    }
    async suggest(inputText, limit = 3) {
        if (!this.initialized || this.documents.length === 0) {
            await this.buildIndex();
        }
        if (!inputText || inputText.trim().length === 0) {
            return [];
        }
        const normalizedInput = this.normalizeText(inputText);
        const scores = [];
        this.documents.forEach((_, index) => {
            let score = 0;
            this.tfidf.tfidfs(normalizedInput, (i, measure) => {
                if (i === index) {
                    score = measure;
                }
            });
            const doc = this.documents[index];
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
            id: this.documents[s.index].id,
            name: this.documents[s.index].name,
            score: s.score,
            confidence: Math.min(Math.round((s.score / maxScore) * 100), 99),
        }));
    }
    async suggestFromConditions(conditions, inputText, limit = 3) {
        if (!conditions || conditions.length === 0) {
            return [];
        }
        if (!inputText || inputText.trim().length === 0) {
            return [];
        }
        const tfidf = new natural.TfIdf();
        const documents = [];
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
        const scores = [];
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
    normalizeText(text) {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
};
exports.ConditionsSimilarityService = ConditionsSimilarityService;
exports.ConditionsSimilarityService = ConditionsSimilarityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ConditionsSimilarityService);
//# sourceMappingURL=conditions-similarity.service.js.map