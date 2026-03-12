import { Response } from 'express';
import { AttachmentsService } from './attachments.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
export declare class AttachmentsController {
    private readonly attachmentsService;
    constructor(attachmentsService: AttachmentsService);
    upload(encounterId: string, file: Express.Multer.File, user: CurrentUserData): Promise<{
        id: string;
        filename: string;
        mime: string;
        size: number;
        uploadedAt: Date;
    }>;
    findByEncounter(encounterId: string, user: CurrentUserData): Promise<{
        id: string;
        size: number;
        originalName: string;
        mime: string;
        uploadedAt: Date;
        uploadedBy: {
            nombre: string;
        };
    }[]>;
    download(id: string, res: Response, user: CurrentUserData): Promise<void>;
    remove(id: string, user: CurrentUserData): Promise<{
        message: string;
    }>;
}
