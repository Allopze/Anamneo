"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentsModule = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const config_1 = require("@nestjs/config");
const multer_1 = require("multer");
const uuid_1 = require("uuid");
const path_1 = require("path");
const attachments_service_1 = require("./attachments.service");
const attachments_controller_1 = require("./attachments.controller");
let AttachmentsModule = class AttachmentsModule {
};
exports.AttachmentsModule = AttachmentsModule;
exports.AttachmentsModule = AttachmentsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            platform_express_1.MulterModule.registerAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (configService) => ({
                    storage: (0, multer_1.diskStorage)({
                        destination: configService.get('UPLOAD_DEST', './uploads'),
                        filename: (req, file, cb) => {
                            const uniqueName = `${(0, uuid_1.v4)()}${(0, path_1.extname)(file.originalname)}`;
                            cb(null, uniqueName);
                        },
                    }),
                    limits: {
                        fileSize: configService.get('UPLOAD_MAX_SIZE', 10 * 1024 * 1024),
                    },
                    fileFilter: (req, file, cb) => {
                        const allowedMimes = [
                            'application/pdf',
                            'image/jpeg',
                            'image/png',
                            'image/gif',
                        ];
                        if (allowedMimes.includes(file.mimetype)) {
                            cb(null, true);
                        }
                        else {
                            cb(new Error('Tipo de archivo no permitido'), false);
                        }
                    },
                }),
            }),
        ],
        controllers: [attachments_controller_1.AttachmentsController],
        providers: [attachments_service_1.AttachmentsService],
        exports: [attachments_service_1.AttachmentsService],
    })
], AttachmentsModule);
//# sourceMappingURL=attachments.module.js.map