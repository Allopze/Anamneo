import { AuditService } from './audit.service';
export declare class AuditController {
    private readonly auditService;
    constructor(auditService: AuditService);
    findAll(page?: string, limit?: string, entityType?: string, userId?: string, action?: string, dateFrom?: string, dateTo?: string): Promise<{
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
}
