import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { SectionKey, EncounterStatus } from '../common/types';
import { RequestUser } from '../common/utils/medico-id';
export declare class EncountersService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    create(patientId: string, createDto: CreateEncounterDto, user: RequestUser): Promise<any>;
    findAll(user: RequestUser, status: EncounterStatus | undefined, search: string | undefined, page?: number, limit?: number): Promise<{
        data: {
            progress: {
                completed: number;
                total: number;
            };
            patient: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                nombre: string;
                medicoId: string;
                rut: string | null;
                rutExempt: boolean;
                rutExemptReason: string | null;
                edad: number;
                sexo: string;
                trabajo: string | null;
                prevision: string;
                domicilio: string | null;
            };
            createdBy: {
                id: string;
                nombre: string;
            };
            sections: {
                completed: boolean;
            }[];
            id: string;
            createdAt: Date;
            updatedAt: Date;
            patientId: string;
            createdById: string;
            status: string;
            completedAt: Date | null;
            completedById: string | null;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    findById(id: string, user: RequestUser): Promise<any>;
    findByPatient(patientId: string, user: RequestUser): Promise<{
        progress: {
            completed: number;
            total: number;
        };
        createdBy: {
            id: string;
            nombre: string;
        };
        sections: {
            sectionKey: string;
            completed: boolean;
        }[];
        id: string;
        createdAt: Date;
        updatedAt: Date;
        patientId: string;
        createdById: string;
        status: string;
        completedAt: Date | null;
        completedById: string | null;
    }[]>;
    updateSection(encounterId: string, sectionKey: SectionKey, dto: UpdateSectionDto, user: RequestUser): Promise<{
        id: string;
        updatedAt: Date;
        data: string;
        encounterId: string;
        sectionKey: string;
        completed: boolean;
    }>;
    complete(id: string, userId: string): Promise<any>;
    reopen(id: string, userId: string): Promise<any>;
    cancel(id: string, userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        patientId: string;
        createdById: string;
        status: string;
        completedAt: Date | null;
        completedById: string | null;
    }>;
    getDashboard(user: RequestUser): Promise<{
        counts: {
            enProgreso: number;
            completado: number;
            cancelado: number;
            total: number;
        };
        recent: {
            id: string;
            patientId: string;
            patientName: string;
            patientRut: string | null;
            createdByName: string;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            progress: {
                completed: number;
                total: number;
            };
        }[];
    }>;
    private formatEncounter;
}
