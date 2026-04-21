import { z } from 'zod';
import { validateRut } from '@/lib/rut';
import type { PatientPrevision, PatientSexo } from '@/types';
import {
  PATIENT_ADDRESS_MAX_LENGTH,
  PATIENT_EMAIL_MAX_LENGTH,
  PATIENT_EMERGENCY_CONTACT_NAME_MAX_LENGTH,
  PATIENT_EMERGENCY_CONTACT_PHONE_MAX_LENGTH,
  PATIENT_JOB_MAX_LENGTH,
  PATIENT_MEDICAL_CENTER_MAX_LENGTH,
  PATIENT_NAME_MAX_LENGTH,
  PATIENT_NAME_MIN_LENGTH,
  PATIENT_PHONE_MAX_LENGTH,
  PATIENT_RUT_EXEMPT_REASON_MAX_LENGTH,
  PATIENT_RUT_MAX_LENGTH,
} from '../../../../../../../shared/patient-field-constraints';

export type EditForm = {
  fechaNacimiento: string;
  sexo: PatientSexo | null;
  prevision: PatientPrevision | null;
  trabajo?: string | null;
  domicilio?: string | null;
  telefono?: string | null;
  email?: string | null;
  contactoEmergenciaNombre?: string | null;
  contactoEmergenciaTelefono?: string | null;
  centroMedico?: string | null;
  nombre?: string;
  rut?: string | null;
  rutExempt?: boolean;
  rutExemptReason?: string | null;
};

export function buildEditSchema(isDoctor: boolean) {
  const base = z.object({
    fechaNacimiento: z.string().optional().default(''),
    sexo: z.enum(['MASCULINO', 'FEMENINO', 'OTRO', 'PREFIERE_NO_DECIR']).nullable(),
    prevision: z.enum(['FONASA', 'ISAPRE', 'OTRA', 'DESCONOCIDA']).nullable(),
    trabajo: z.string()
      .max(PATIENT_JOB_MAX_LENGTH, `El trabajo no puede exceder ${PATIENT_JOB_MAX_LENGTH} caracteres`)
      .nullable()
      .optional(),
    domicilio: z.string()
      .max(PATIENT_ADDRESS_MAX_LENGTH, `El domicilio no puede exceder ${PATIENT_ADDRESS_MAX_LENGTH} caracteres`)
      .nullable()
      .optional(),
    telefono: z.string()
      .max(PATIENT_PHONE_MAX_LENGTH, `El teléfono no puede exceder ${PATIENT_PHONE_MAX_LENGTH} caracteres`)
      .nullable()
      .optional(),
    email: z.string()
      .max(PATIENT_EMAIL_MAX_LENGTH, `El email no puede exceder ${PATIENT_EMAIL_MAX_LENGTH} caracteres`)
      .nullable()
      .optional()
      .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()), 'Email inválido'),
    contactoEmergenciaNombre: z.string()
      .max(
        PATIENT_EMERGENCY_CONTACT_NAME_MAX_LENGTH,
        `El contacto de emergencia no puede exceder ${PATIENT_EMERGENCY_CONTACT_NAME_MAX_LENGTH} caracteres`,
      )
      .nullable()
      .optional(),
    contactoEmergenciaTelefono: z.string()
      .max(
        PATIENT_EMERGENCY_CONTACT_PHONE_MAX_LENGTH,
        `El teléfono de emergencia no puede exceder ${PATIENT_EMERGENCY_CONTACT_PHONE_MAX_LENGTH} caracteres`,
      )
      .nullable()
      .optional(),
    centroMedico: z.string()
      .max(
        PATIENT_MEDICAL_CENTER_MAX_LENGTH,
        `El centro médico no puede exceder ${PATIENT_MEDICAL_CENTER_MAX_LENGTH} caracteres`,
      )
      .nullable()
      .optional(),
  });

  if (!isDoctor) return base;

  return base
    .extend({
      nombre: z.string()
        .min(PATIENT_NAME_MIN_LENGTH, `El nombre debe tener al menos ${PATIENT_NAME_MIN_LENGTH} caracteres`)
        .max(PATIENT_NAME_MAX_LENGTH, `El nombre no puede exceder ${PATIENT_NAME_MAX_LENGTH} caracteres`),
      rut: z.string()
        .max(PATIENT_RUT_MAX_LENGTH, `El RUT no puede exceder ${PATIENT_RUT_MAX_LENGTH} caracteres`)
        .nullable()
        .optional(),
      rutExempt: z.boolean().default(false),
      rutExemptReason: z.string()
        .max(
          PATIENT_RUT_EXEMPT_REASON_MAX_LENGTH,
          `El motivo no puede exceder ${PATIENT_RUT_EXEMPT_REASON_MAX_LENGTH} caracteres`,
        )
        .nullable()
        .optional(),
    })
    .superRefine((val, ctx) => {
      const anyVal = val as EditForm;
      if (anyVal.rutExempt) {
        if (!anyVal.rutExemptReason || anyVal.rutExemptReason.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rutExemptReason'],
            message: 'Debe indicar el motivo de exencion de RUT',
          });
        }
      } else if (anyVal.rut && anyVal.rut.trim().length > 0 && !validateRut(anyVal.rut).valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rut'],
          message: 'RUT inválido (ej: 12.345.678-5)',
        });
      }
    });
}
