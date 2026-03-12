"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseSectionKeyPipe = void 0;
const common_1 = require("@nestjs/common");
const update_section_dto_1 = require("../encounters/dto/update-section.dto");
let ParseSectionKeyPipe = class ParseSectionKeyPipe {
    transform(value) {
        if (!update_section_dto_1.VALID_SECTION_KEYS.includes(value)) {
            throw new common_1.BadRequestException(`Sección inválida: "${value}". Valores permitidos: ${update_section_dto_1.VALID_SECTION_KEYS.join(', ')}`);
        }
        return value;
    }
};
exports.ParseSectionKeyPipe = ParseSectionKeyPipe;
exports.ParseSectionKeyPipe = ParseSectionKeyPipe = __decorate([
    (0, common_1.Injectable)()
], ParseSectionKeyPipe);
//# sourceMappingURL=parse-section-key.pipe.js.map