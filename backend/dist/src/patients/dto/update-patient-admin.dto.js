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
exports.UpdatePatientAdminDto = void 0;
const class_validator_1 = require("class-validator");
const types_1 = require("../../common/types");
class UpdatePatientAdminDto {
}
exports.UpdatePatientAdminDto = UpdatePatientAdminDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0, { message: 'La edad debe ser mayor a 0' }),
    (0, class_validator_1.Max)(150, { message: 'La edad no puede ser mayor a 150' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdatePatientAdminDto.prototype, "edad", void 0);
__decorate([
    (0, class_validator_1.IsIn)(types_1.SEXOS, { message: 'El sexo debe ser válido' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdatePatientAdminDto.prototype, "sexo", void 0);
__decorate([
    (0, class_validator_1.IsIn)(types_1.PREVISIONES, { message: 'La previsión debe ser válida' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdatePatientAdminDto.prototype, "prevision", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdatePatientAdminDto.prototype, "trabajo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdatePatientAdminDto.prototype, "domicilio", void 0);
//# sourceMappingURL=update-patient-admin.dto.js.map