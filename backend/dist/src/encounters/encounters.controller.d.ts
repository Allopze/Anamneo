import { Response } from 'express';
import { EncountersService } from './encounters.service';
import { EncountersPdfService } from './encounters-pdf.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { EncounterStatus, SectionKey } from '../common/types';
export declare class EncountersController {
    private readonly encountersService;
    private readonly encountersPdfService;
    constructor(encountersService: EncountersService, encountersPdfService: EncountersPdfService);
    create(patientId: string, createDto: CreateEncounterDto, user: CurrentUserData): Promise<any>;
    findAll(user: CurrentUserData, status?: EncounterStatus, search?: string, page?: number, limit?: number): Promise<{
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
    dashboard(user: CurrentUserData): Promise<{
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
    exportPdf(id: string, user: CurrentUserData, res: Response): Promise<void>;
    findOne(id: string, user: CurrentUserData): Promise<any>;
    findByPatient(patientId: string, user: CurrentUserData): Promise<{
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
    updateSection(id: string, sectionKey: SectionKey, updateDto: UpdateSectionDto, user: CurrentUserData): Promise<{
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
}
