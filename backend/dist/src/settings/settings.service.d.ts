import { PrismaService } from '../prisma/prisma.service';
export declare class SettingsService {
    private prisma;
    constructor(prisma: PrismaService);
    getAll(): Promise<Record<string, string>>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<{
        id: string;
        updatedAt: Date;
        value: string;
        key: string;
    }>;
    setMany(data: Record<string, string>): Promise<{
        id: string;
        updatedAt: Date;
        value: string;
        key: string;
    }[]>;
    delete(key: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
}
