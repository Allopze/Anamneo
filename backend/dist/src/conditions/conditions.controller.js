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
exports.ConditionsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const conditions_service_1 = require("./conditions.service");
const create_condition_dto_1 = require("./dto/create-condition.dto");
const update_condition_dto_1 = require("./dto/update-condition.dto");
const suggest_condition_dto_1 = require("./dto/suggest-condition.dto");
const save_suggestion_dto_1 = require("./dto/save-suggestion.dto");
const create_local_condition_dto_1 = require("./dto/create-local-condition.dto");
const update_local_condition_dto_1 = require("./dto/update-local-condition.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const admin_guard_1 = require("../common/guards/admin.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let ConditionsController = class ConditionsController {
    constructor(conditionsService) {
        this.conditionsService = conditionsService;
    }
    create(createDto) {
        return this.conditionsService.create(createDto);
    }
    importCsv(file) {
        if (!file) {
            throw new common_1.BadRequestException('Debe adjuntar un archivo CSV');
        }
        return this.conditionsService.importGlobalCsv(file.buffer);
    }
    findAll(search, user) {
        return this.conditionsService.findAll(search, user);
    }
    findOne(id) {
        return this.conditionsService.findById(id);
    }
    update(id, updateDto) {
        return this.conditionsService.update(id, updateDto);
    }
    remove(id) {
        return this.conditionsService.remove(id);
    }
    suggest(suggestDto, user) {
        return this.conditionsService.suggest(user, suggestDto);
    }
    createLocal(user, createDto) {
        return this.conditionsService.createLocal(user, createDto);
    }
    updateLocal(user, id, updateDto) {
        return this.conditionsService.updateLocal(user, id, updateDto);
    }
    removeLocal(user, id) {
        return this.conditionsService.removeLocal(user, id);
    }
    hideBaseCondition(user, baseId) {
        return this.conditionsService.hideBaseCondition(user, baseId);
    }
    saveSuggestion(encounterId, dto, user) {
        return this.conditionsService.saveSuggestionChoice(encounterId, dto, user);
    }
};
exports.ConditionsController = ConditionsController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_condition_dto_1.CreateConditionDto]),
    __metadata("design:returntype", void 0)
], ConditionsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('import/csv'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        limits: {
            fileSize: 1024 * 1024,
        },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ConditionsController.prototype, "importCsv", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ConditionsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ConditionsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_condition_dto_1.UpdateConditionDto]),
    __metadata("design:returntype", void 0)
], ConditionsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ConditionsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('suggest'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [suggest_condition_dto_1.SuggestConditionDto, Object]),
    __metadata("design:returntype", void 0)
], ConditionsController.prototype, "suggest", null);
__decorate([
    (0, common_1.Post)('local'),
    (0, roles_decorator_1.Roles)('MEDICO', 'ASISTENTE'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_local_condition_dto_1.CreateLocalConditionDto]),
    __metadata("design:returntype", void 0)
], ConditionsController.prototype, "createLocal", null);
__decorate([
    (0, common_1.Put)('local/:id'),
    (0, roles_decorator_1.Roles)('MEDICO', 'ASISTENTE'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_local_condition_dto_1.UpdateLocalConditionDto]),
    __metadata("design:returntype", void 0)
], ConditionsController.prototype, "updateLocal", null);
__decorate([
    (0, common_1.Delete)('local/:id'),
    (0, roles_decorator_1.Roles)('MEDICO', 'ASISTENTE'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ConditionsController.prototype, "removeLocal", null);
__decorate([
    (0, common_1.Delete)('local/base/:baseId'),
    (0, roles_decorator_1.Roles)('MEDICO', 'ASISTENTE'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('baseId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ConditionsController.prototype, "hideBaseCondition", null);
__decorate([
    (0, common_1.Post)('encounters/:encounterId/suggestion'),
    (0, roles_decorator_1.Roles)('MEDICO'),
    __param(0, (0, common_1.Param)('encounterId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, save_suggestion_dto_1.SaveSuggestionDto, Object]),
    __metadata("design:returntype", void 0)
], ConditionsController.prototype, "saveSuggestion", null);
exports.ConditionsController = ConditionsController = __decorate([
    (0, common_1.Controller)('conditions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [conditions_service_1.ConditionsService])
], ConditionsController);
//# sourceMappingURL=conditions.controller.js.map