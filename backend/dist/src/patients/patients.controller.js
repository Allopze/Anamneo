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
exports.PatientsController = void 0;
const common_1 = require("@nestjs/common");
const patients_service_1 = require("./patients.service");
const create_patient_dto_1 = require("./dto/create-patient.dto");
const create_patient_quick_dto_1 = require("./dto/create-patient-quick.dto");
const update_patient_dto_1 = require("./dto/update-patient.dto");
const update_patient_admin_dto_1 = require("./dto/update-patient-admin.dto");
const update_patient_history_dto_1 = require("./dto/update-patient-history.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const admin_guard_1 = require("../common/guards/admin.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let PatientsController = class PatientsController {
    constructor(patientsService) {
        this.patientsService = patientsService;
    }
    create(createPatientDto, userId) {
        return this.patientsService.create(createPatientDto, userId);
    }
    createQuick(createPatientDto, user) {
        return this.patientsService.createQuick(createPatientDto, user);
    }
    async exportCsv(res) {
        const csv = await this.patientsService.exportCsv();
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=pacientes_${new Date().toISOString().slice(0, 10)}.csv`);
        res.send(csv);
    }
    findAll(user, search, page, limit, sexo, prevision, edadMin, edadMax, sortBy, sortOrder) {
        return this.patientsService.findAll(user, search, page || 1, limit || 20, {
            sexo, prevision,
            edadMin: edadMin ? parseInt(edadMin, 10) : undefined,
            edadMax: edadMax ? parseInt(edadMax, 10) : undefined,
            sortBy: sortBy,
            sortOrder: (sortOrder || 'asc'),
        });
    }
    findOne(id, user) {
        return this.patientsService.findById(user, id);
    }
    update(id, updatePatientDto, userId) {
        return this.patientsService.update(id, updatePatientDto, userId);
    }
    updateAdmin(id, dto, user) {
        return this.patientsService.updateAdminFields(user, id, dto);
    }
    updateHistory(id, updateHistoryDto, user) {
        return this.patientsService.updateHistory(user, id, updateHistoryDto);
    }
    remove(id, userId) {
        return this.patientsService.remove(id, userId);
    }
};
exports.PatientsController = PatientsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('MEDICO'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_patient_dto_1.CreatePatientDto, String]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('quick'),
    (0, roles_decorator_1.Roles)('MEDICO', 'ASISTENTE'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_patient_quick_dto_1.CreatePatientQuickDto, Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "createQuick", null);
__decorate([
    (0, common_1.Get)('export/csv'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PatientsController.prototype, "exportCsv", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('search')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __param(4, (0, common_1.Query)('sexo')),
    __param(5, (0, common_1.Query)('prevision')),
    __param(6, (0, common_1.Query)('edadMin')),
    __param(7, (0, common_1.Query)('edadMax')),
    __param(8, (0, common_1.Query)('sortBy')),
    __param(9, (0, common_1.Query)('sortOrder')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Number, Number, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Roles)('MEDICO'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_patient_dto_1.UpdatePatientDto, String]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "update", null);
__decorate([
    (0, common_1.Put)(':id/admin'),
    (0, roles_decorator_1.Roles)('MEDICO', 'ASISTENTE'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_patient_admin_dto_1.UpdatePatientAdminDto, Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "updateAdmin", null);
__decorate([
    (0, common_1.Put)(':id/history'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_patient_history_dto_1.UpdatePatientHistoryDto, Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "updateHistory", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)('MEDICO'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "remove", null);
exports.PatientsController = PatientsController = __decorate([
    (0, common_1.Controller)('patients'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [patients_service_1.PatientsService])
], PatientsController);
//# sourceMappingURL=patients.controller.js.map