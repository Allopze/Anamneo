import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { CreatePatientQuickDto } from './dto/create-patient-quick.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpdatePatientAdminDto } from './dto/update-patient-admin.dto';
import { UpdatePatientHistoryDto } from './dto/update-patient-history.dto';
import { RequestUser } from '../common/utils/medico-id';
export declare class PatientsService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
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
    createQuick(createPatientDto: CreatePatientQuickDto, user: RequestUser): Promise<{
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
    findAll(user: RequestUser, search?: string, page?: number, limit?: number, filters?: {
        sexo?: string;
        prevision?: string;
        edadMin?: number;
        edadMax?: number;
        sortBy?: 'nombre' | 'edad' | 'createdAt' | 'updatedAt';
        sortOrder?: 'asc' | 'desc';
    }): Promise<{
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
    exportCsv(): Promise<string>;
    findById(user: RequestUser, id: string): Promise<{
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
    updateAdminFields(user: RequestUser, patientId: string, dto: UpdatePatientAdminDto): Promise<{
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
    updateHistory(user: RequestUser, patientId: string, dto: UpdatePatientHistoryDto): Promise<{
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
