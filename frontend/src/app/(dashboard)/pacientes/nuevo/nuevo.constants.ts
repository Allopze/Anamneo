import { z } from 'zod';
import { validateRut } from '@/lib/rut';
import { calculateAgeFromBirthDate } from '@/lib/date';
import { isValidChileanPhone } from '../../../../../../shared/chilean-phone';
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
  PATIENT_RUT_EXEMPT_REASON_MIN_LENGTH,
  PATIENT_RUT_MAX_LENGTH,
} from '../../../../../../shared/patient-field-constraints';

const basePatientObject = z.object({
  nombre: z.string()
    .min(PATIENT_NAME_MIN_LENGTH, `El nombre debe tener al menos ${PATIENT_NAME_MIN_LENGTH} caracteres`)
    .max(PATIENT_NAME_MAX_LENGTH, `El nombre no puede exceder ${PATIENT_NAME_MAX_LENGTH} caracteres`),
  fechaNacimiento: z.string().optional(),
  sexo: z.enum(['MASCULINO', 'FEMENINO', 'OTRO', 'PREFIERE_NO_DECIR'], {
    errorMap: () => ({ message: 'Selecciona el sexo del paciente' }),
  }).optional(),
  prevision: z.enum(['FONASA', 'ISAPRE', 'OTRA', 'DESCONOCIDA'], {
    errorMap: () => ({ message: 'Selecciona la previsión de salud' }),
  }).optional(),
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
  telefono: z.string()
    .max(PATIENT_PHONE_MAX_LENGTH, `El teléfono no puede exceder ${PATIENT_PHONE_MAX_LENGTH} caracteres`)
    .optional()
    .refine((value) => isValidChileanPhone(value), 'El teléfono debe ser un número chileno válido (ej: +56 9 1234 5678)'),
  email: z.string()
    .max(PATIENT_EMAIL_MAX_LENGTH, `El email no puede exceder ${PATIENT_EMAIL_MAX_LENGTH} caracteres`)
    .optional()
    .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()), 'Email inválido'),
  contactoEmergenciaNombre: z.string()
    .max(
      PATIENT_EMERGENCY_CONTACT_NAME_MAX_LENGTH,
      `El contacto de emergencia no puede exceder ${PATIENT_EMERGENCY_CONTACT_NAME_MAX_LENGTH} caracteres`,
    )
    .optional(),
  contactoEmergenciaTelefono: z.string()
    .max(
      PATIENT_EMERGENCY_CONTACT_PHONE_MAX_LENGTH,
      `El teléfono de emergencia no puede exceder ${PATIENT_EMERGENCY_CONTACT_PHONE_MAX_LENGTH} caracteres`,
    )
    .optional()
    .refine((value) => isValidChileanPhone(value), 'El teléfono de emergencia debe ser un número chileno válido (ej: +56 9 1234 5678)'),
  centroMedico: z.string()
    .max(
      PATIENT_MEDICAL_CENTER_MAX_LENGTH,
      `El centro médico no puede exceder ${PATIENT_MEDICAL_CENTER_MAX_LENGTH} caracteres`,
    )
    .optional(),
  // Ley 21.719 Art 16 quáter — representante legal para NNA
  legalRepresentativeName: z.string().max(200).optional(),
  legalRepresentativeRut: z.string().max(20).optional(),
  legalRepresentativeRelationship: z.preprocess(
    (value) => value === '' ? undefined : value,
    z.enum(['PADRE', 'MADRE', 'TUTOR', 'REPRESENTANTE']).optional(),
  ),
  legalRepresentativeContact: z.string().max(200).optional(),
});

const rutExemptRefine = (val: z.infer<typeof basePatientObject>, ctx: z.RefinementCtx) => {
  if (val.rutExempt && (!val.rutExemptReason || val.rutExemptReason.trim().length < PATIENT_RUT_EXEMPT_REASON_MIN_LENGTH)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rutExemptReason'],
      message: `Debe indicar el motivo de exención de RUT (mín. ${PATIENT_RUT_EXEMPT_REASON_MIN_LENGTH} caracteres)`,
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
  sexo: z.enum(['MASCULINO', 'FEMENINO', 'OTRO', 'PREFIERE_NO_DECIR'], {
    errorMap: () => ({ message: 'Selecciona el sexo del paciente' }),
  }),
  prevision: z.enum(['FONASA', 'ISAPRE', 'OTRA', 'DESCONOCIDA'], {
    errorMap: () => ({ message: 'Selecciona la previsión de salud' }),
  }),
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
