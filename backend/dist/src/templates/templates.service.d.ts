import { PrismaService } from '../prisma/prisma.service';
export declare class TemplatesService {
    private prisma;
    constructor(prisma: PrismaService);
    findByMedico(medicoId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        medicoId: string;
        sectionKey: string | null;
        category: string;
        content: string;
    }[]>;
    create(medicoId: string, data: {
        name: string;
        category?: string;
        content: string;
        sectionKey?: string;
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        medicoId: string;
        sectionKey: string | null;
        category: string;
        content: string;
    }>;
    update(id: string, medicoId: string, data: {
        name?: string;
        category?: string;
        content?: string;
        sectionKey?: string;
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        medicoId: string;
        sectionKey: string | null;
        category: string;
        content: string;
    }>;
    delete(id: string, medicoId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        medicoId: string;
        sectionKey: string | null;
        category: string;
        content: string;
    }>;
}
