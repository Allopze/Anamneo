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
exports.SaveSuggestionDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class SuggestionItem {
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SuggestionItem.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SuggestionItem.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], SuggestionItem.prototype, "score", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], SuggestionItem.prototype, "confidence", void 0);
class SaveSuggestionDto {
}
exports.SaveSuggestionDto = SaveSuggestionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], SaveSuggestionDto.prototype, "inputText", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SuggestionItem),
    __metadata("design:type", Array)
], SaveSuggestionDto.prototype, "suggestions", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.chosenConditionId !== null),
    (0, class_validator_1.IsUUID)(undefined, { message: 'chosenConditionId debe ser un UUID válido' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], SaveSuggestionDto.prototype, "chosenConditionId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['AUTO', 'MANUAL'], { message: 'chosenMode debe ser AUTO o MANUAL' }),
    __metadata("design:type", String)
], SaveSuggestionDto.prototype, "chosenMode", void 0);
//# sourceMappingURL=save-suggestion.dto.js.map