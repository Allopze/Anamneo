import { z } from 'zod';
import { validateRut } from '@/lib/rut';
import { calculateAgeFromBirthDate } from '@/lib/date';
import {
  PATIENT_ADDRESS_MAX_LENGTH,
  PATIENT_JOB_MAX_LENGTH,
  PATIENT_MEDICAL_CENTER_MAX_LENGTH,
  PATIENT_NAME_MAX_LENGTH,
  PATIENT_NAME_MIN_LENGTH,
  PATIENT_RUT_EXEMPT_REASON_MAX_LENGTH,
  PATIENT_RUT_MAX_LENGTH,
} from '../../../../../../shared/patient-field-constraints';

const basePatientObject = z.object({
  nombre: z.string()
    .min(PATIENT_NAME_MIN_LENGTH, `El nombre debe tener al menos ${PATIENT_NAME_MIN_LENGTH} caracteres`)
    .max(PATIENT_NAME_MAX_LENGTH, `El nombre no puede exceder ${PATIENT_NAME_MAX_LENGTH} caracteres`),
  fechaNacimiento: z.string().optional(),
  sexo: z.enum(['MASCULINO', 'FEMENINO', 'OTRO', 'PREFIERE_NO_DECIR']).optional(),
  prevision: z.enum(['FONASA', 'ISAPRE', 'OTRA', 'DESCONOCIDA']).optional(),
  rut: z.string().max(PATIENT_RUT_MAX_LENGTH, `El RUT no puede exceder ${PATIENT_RUT_MAX_LENGTH} caracteres`).optional(),
  rutExempt: z.boolean().default(false),
  rutExemptReason: z.string()
    .max(
      PATIENT_RUT_EXEMPT_REASON_MAX_LENGTH,
      `El motivo no puede exceder ${PATIENT_RUT_EXEMPT_REASON_MAX_LENGTH} caracteres`,
    )
    .optional(),
  trabajo: z.string().max(PATIENT_JOB_MAX_LENGTH, `El trabajo no puede exceder ${PATIENT_JOB_MAX_LENGTH} caracteres`).optional(),
  domicilio: z.string()
    .max(PATIENT_ADDRESS_MAX_LENGTH, `El domicilio no puede exceder ${PATIENT_ADDRESS_MAX_LENGTH} caracteres`)
    .optional(),
  centroMedico: z.string()
    .max(
      PATIENT_MEDICAL_CENTER_MAX_LENGTH,
      `El centro médico no puede exceder ${PATIENT_MEDICAL_CENTER_MAX_LENGTH} caracteres`,
    )
    .optional(),
});

const rutExemptRefine = (val: z.infer<typeof basePatientObject>, ctx: z.RefinementCtx) => {
  if (val.rutExempt && (!val.rutExemptReason || val.rutExemptReason.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rutExemptReason'],
      message: 'Debe indicar el motivo de exencion de RUT',
    });
  }
  if (!val.rutExempt && val.rut && val.rut.trim().length > 0 && !validateRut(val.rut).valid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rut'],
      message: 'RUT inválido (ej: 12.345.678-5)',
    });
  }
};

export const basePatientSchema = basePatientObject.superRefine(rutExemptRefine);

export const fullPatientSchema = basePatientObject.extend({
  fechaNacimiento: z.string().min(1, 'La fecha de nacimiento es obligatoria'),
  sexo: z.enum(['MASCULINO', 'FEMENINO', 'OTRO', 'PREFIERE_NO_DECIR']),
  prevision: z.enum(['FONASA', 'ISAPRE', 'OTRA', 'DESCONOCIDA']),
}).superRefine((val, ctx) => {
  rutExemptRefine(val, ctx);

  if (!val.fechaNacimiento || !calculateAgeFromBirthDate(val.fechaNacimiento)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fechaNacimiento'],
      message: 'Debe ingresar una fecha de nacimiento válida',
    });
  }
});

export type PatientForm = z.infer<typeof basePatientSchema>;
