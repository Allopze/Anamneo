import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/utils/medico-id';
export declare class EncountersPdfService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    generatePdf(encounterId: string, user: RequestUser): Promise<Buffer>;
}
