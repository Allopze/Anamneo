import { Response } from 'express';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { CreatePatientQuickDto } from './dto/create-patient-quick.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpdatePatientAdminDto } from './dto/update-patient-admin.dto';
import { UpdatePatientHistoryDto } from './dto/update-patient-history.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
export declare class PatientsController {
    private readonly patientsService;
    constructor(patientsService: PatientsService);
    create(createPatientDto: CreatePatientDto, userId: string): Promise<{
        history: {
            id: string;
            updatedAt: Date;
            patientId: string;
            antecedentesMedicos: string | null;
            antecedentesQuirurgicos: string | null;
            antecedentesGinecoobstetricos: string | null;
            antecedentesFamiliares: string | null;
            habitos: string | null;
            medicamentos: string | null;
            alergias: string | null;
            inmunizaciones: string | null;
            antecedentesSociales: string | null;
            antecedentesPersonales: string | null;
        } | null;
    } & {
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
    }>;
    createQuick(createPatientDto: CreatePatientQuickDto, user: CurrentUserData): Promise<{
        history: {
            id: string;
            updatedAt: Date;
            patientId: string;
            antecedentesMedicos: string | null;
            antecedentesQuirurgicos: string | null;
            antecedentesGinecoobstetricos: string | null;
            antecedentesFamiliares: string | null;
            habitos: string | null;
            medicamentos: string | null;
            alergias: string | null;
            inmunizaciones: string | null;
            antecedentesSociales: string | null;
            antecedentesPersonales: string | null;
        } | null;
    } & {
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
    }>;
    exportCsv(res: Response): Promise<void>;
    findAll(user: CurrentUserData, search?: string, page?: number, limit?: number, sexo?: string, prevision?: string, edadMin?: string, edadMax?: string, sortBy?: string, sortOrder?: string): Promise<{
        data: ({
            _count: {
                encounters: number;
            };
        } & {
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
        })[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    findOne(id: string, user: CurrentUserData): Promise<{
        encounters: ({
            createdBy: {
                id: string;
                nombre: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            patientId: string;
            createdById: string;
            status: string;
            completedAt: Date | null;
            completedById: string | null;
        })[];
        history: {
            id: string;
            updatedAt: Date;
            patientId: string;
            antecedentesMedicos: string | null;
            antecedentesQuirurgicos: string | null;
            antecedentesGinecoobstetricos: string | null;
            antecedentesFamiliares: string | null;
            habitos: string | null;
            medicamentos: string | null;
            alergias: string | null;
            inmunizaciones: string | null;
            antecedentesSociales: string | null;
            antecedentesPersonales: string | null;
        } | null;
    } & {
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
    }>;
    update(id: string, updatePatientDto: UpdatePatientDto, userId: string): Promise<{
        history: {
            id: string;
            updatedAt: Date;
            patientId: string;
            antecedentesMedicos: string | null;
            antecedentesQuirurgicos: string | null;
            antecedentesGinecoobstetricos: string | null;
            antecedentesFamiliares: string | null;
            habitos: string | null;
            medicamentos: string | null;
            alergias: string | null;
            inmunizaciones: string | null;
            antecedentesSociales: string | null;
            antecedentesPersonales: string | null;
        } | null;
    } & {
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
    }>;
    updateAdmin(id: string, dto: UpdatePatientAdminDto, user: CurrentUserData): Promise<{
        history: {
            id: string;
            updatedAt: Date;
            patientId: string;
            antecedentesMedicos: string | null;
            antecedentesQuirurgicos: string | null;
            antecedentesGinecoobstetricos: string | null;
            antecedentesFamiliares: string | null;
            habitos: string | null;
            medicamentos: string | null;
            alergias: string | null;
            inmunizaciones: string | null;
            antecedentesSociales: string | null;
            antecedentesPersonales: string | null;
        } | null;
    } & {
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
    }>;
    updateHistory(id: string, updateHistoryDto: UpdatePatientHistoryDto, user: CurrentUserData): Promise<{
        id: string;
        updatedAt: Date;
        patientId: string;
        antecedentesMedicos: string | null;
        antecedentesQuirurgicos: string | null;
        antecedentesGinecoobstetricos: string | null;
        antecedentesFamiliares: string | null;
        habitos: string | null;
        medicamentos: string | null;
        alergias: string | null;
        inmunizaciones: string | null;
        antecedentesSociales: string | null;
        antecedentesPersonales: string | null;
    }>;
    remove(id: string, userId: string): Promise<{
        message: string;
    }>;
}
