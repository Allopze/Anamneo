import { PrismaService } from '../prisma/prisma.service';
interface LogInput {
    entityType: string;
    entityId: string;
    userId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    diff?: any;
}
export declare class AuditService {
    private prisma;
    constructor(prisma: PrismaService);
    log(input: LogInput): Promise<{
        id: string;
        entityType: string;
        entityId: string;
        userId: string;
        action: string;
        diff: string | null;
        timestamp: Date;
    }>;
    findAll(page?: number, limit?: number, filters?: {
        entityType?: string;
        userId?: string;
        action?: string;
        dateFrom?: string;
        dateTo?: string;
    }): Promise<{
        data: {
            id: string;
            entityType: string;
            entityId: string;
            userId: string;
            action: string;
            diff: string | null;
            timestamp: Date;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    findByEntity(entityType: string, entityId: string): Promise<{
        id: string;
        entityType: string;
        entityId: string;
        userId: string;
        action: string;
        diff: string | null;
        timestamp: Date;
    }[]>;
    findByUser(userId: string, page?: number, limit?: number): Promise<{
        data: {
            id: string;
            entityType: string;
            entityId: string;
            userId: string;
            action: string;
            diff: string | null;
            timestamp: Date;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    private sanitizeDiff;
    private minimizeClinicalDiff;
}
export {};
