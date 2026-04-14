import { z } from 'zod';
import { validateRut } from '@/lib/rut';
import { calculateAgeFromBirthDate } from '@/lib/date';

const basePatientObject = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  fechaNacimiento: z.string().optional(),
  sexo: z.enum(['MASCULINO', 'FEMENINO', 'OTRO', 'PREFIERE_NO_DECIR']).optional(),
  prevision: z.enum(['FONASA', 'ISAPRE', 'OTRA', 'DESCONOCIDA']).optional(),
  rut: z.string().optional(),
  rutExempt: z.boolean().default(false),
  rutExemptReason: z.string().optional(),
  trabajo: z.string().optional(),
  domicilio: z.string().optional(),
  centroMedico: z.string().optional(),
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
