"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConditionsModule = void 0;
const common_1 = require("@nestjs/common");
const conditions_service_1 = require("./conditions.service");
const conditions_similarity_service_1 = require("./conditions-similarity.service");
const conditions_controller_1 = require("./conditions.controller");
let ConditionsModule = class ConditionsModule {
};
exports.ConditionsModule = ConditionsModule;
exports.ConditionsModule = ConditionsModule = __decorate([
    (0, common_1.Module)({
        controllers: [conditions_controller_1.ConditionsController],
        providers: [conditions_service_1.ConditionsService, conditions_similarity_service_1.ConditionsSimilarityService],
        exports: [conditions_service_1.ConditionsService, conditions_similarity_service_1.ConditionsSimilarityService],
    })
], ConditionsModule);
//# sourceMappingURL=conditions.module.js.map