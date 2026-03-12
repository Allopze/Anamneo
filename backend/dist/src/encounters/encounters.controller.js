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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncountersController = void 0;
const common_1 = require("@nestjs/common");
const encounters_service_1 = require("./encounters.service");
const encounters_pdf_service_1 = require("./encounters-pdf.service");
const create_encounter_dto_1 = require("./dto/create-encounter.dto");
const update_section_dto_1 = require("./dto/update-section.dto");
const parse_section_key_pipe_1 = require("../common/parse-section-key.pipe");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let EncountersController = class EncountersController {
    constructor(encountersService, encountersPdfService) {
        this.encountersService = encountersService;
        this.encountersPdfService = encountersPdfService;
    }
    create(patientId, createDto, user) {
        return this.encountersService.create(patientId, createDto, user);
    }
    findAll(user, status, search, page, limit) {
        return this.encountersService.findAll(user, status, search, page || 1, limit || 15);
    }
    dashboard(user) {
        return this.encountersService.getDashboard(user);
    }
    async exportPdf(id, user, res) {
        const pdfBuffer = await this.encountersPdfService.generatePdf(id, user);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="ficha_clinica_${id.slice(0, 8)}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);
    }
    findOne(id, user) {
        return this.encountersService.findById(id, user);
    }
    findByPatient(patientId, user) {
        return this.encountersService.findByPatient(patientId, user);
    }
    updateSection(id, sectionKey, updateDto, user) {
        const serialized = JSON.stringify(updateDto.data);
        if (serialized.length > 100_000) {
            throw new common_1.BadRequestException('Los datos de la sección exceden el tamaño máximo permitido (100 KB)');
        }
        return this.encountersService.updateSection(id, sectionKey, updateDto, user);
    }
    complete(id, userId) {
        return this.encountersService.complete(id, userId);
    }
    reopen(id, userId) {
        return this.encountersService.reopen(id, userId);
    }
    cancel(id, userId) {
        return this.encountersService.cancel(id, userId);
    }
};
exports.EncountersController = EncountersController;
__decorate([
    (0, common_1.Post)('patient/:patientId'),
    (0, roles_decorator_1.Roles)('MEDICO', 'ASISTENTE'),
    __param(0, (0, common_1.Param)('patientId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_encounter_dto_1.CreateEncounterDto, Object]),
    __metadata("design:returntype", void 0)
], EncountersController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('search')),
    __param(3, (0, common_1.Query)('page')),
    __param(4, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Number, Number]),
    __metadata("design:returntype", void 0)
], EncountersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('stats/dashboard'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EncountersController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Get)(':id/export/pdf'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], EncountersController.prototype, "exportPdf", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], EncountersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('patient/:patientId'),
    __param(0, (0, common_1.Param)('patientId', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], EncountersController.prototype, "findByPatient", null);
__decorate([
    (0, common_1.Put)(':id/sections/:sectionKey'),
    (0, roles_decorator_1.Roles)('MEDICO', 'ASISTENTE'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('sectionKey', parse_section_key_pipe_1.ParseSectionKeyPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_section_dto_1.UpdateSectionDto, Object]),
    __metadata("design:returntype", void 0)
], EncountersController.prototype, "updateSection", null);
__decorate([
    (0, common_1.Post)(':id/complete'),
    (0, roles_decorator_1.Roles)('MEDICO'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], EncountersController.prototype, "complete", null);
__decorate([
    (0, common_1.Post)(':id/reopen'),
    (0, roles_decorator_1.Roles)('ADMIN'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], EncountersController.prototype, "reopen", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    (0, roles_decorator_1.Roles)('MEDICO'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], EncountersController.prototype, "cancel", null);
exports.EncountersController = EncountersController = __decorate([
    (0, common_1.Controller)('encounters'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [encounters_service_1.EncountersService,
        encounters_pdf_service_1.EncountersPdfService])
], EncountersController);
//# sourceMappingURL=encounters.controller.js.map