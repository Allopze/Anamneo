import { Sexo, Prevision } from '../../common/types';
export declare class CreatePatientDto {
    rut?: string;
    rutExempt?: boolean;
    rutExemptReason?: string;
    nombre: string;
    edad: number;
    sexo: Sexo;
    trabajo?: string;
    prevision: Prevision;
    domicilio?: string;
}
