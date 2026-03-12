import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/utils/medico-id';
export declare class AttachmentsService {
    private prisma;
    constructor(prisma: PrismaService);
    create(encounterId: string, file: Express.Multer.File, user: RequestUser): Promise<{
        id: string;
        filename: string;
        mime: string;
        size: number;
        uploadedAt: Date;
    }>;
    findByEncounter(encounterId: string, user: RequestUser): Promise<{
        id: string;
        size: number;
        originalName: string;
        mime: string;
        uploadedAt: Date;
        uploadedBy: {
            nombre: string;
        };
    }[]>;
    getFile(id: string, user: RequestUser): Promise<{
        path: string;
        filename: string;
        mime: string;
    }>;
    remove(id: string, userId: string): Promise<{
        message: string;
    }>;
}
