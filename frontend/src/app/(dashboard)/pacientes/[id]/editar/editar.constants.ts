import { z } from 'zod';
import { validateRut } from '@/lib/rut';
import type { PatientPrevision, PatientSexo } from '@/types';

export type EditForm = {
  fechaNacimiento: string;
  sexo: PatientSexo | null;
  prevision: PatientPrevision | null;
  trabajo?: string | null;
  domicilio?: string | null;
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
    trabajo: z.string().nullable().optional(),
    domicilio: z.string().nullable().optional(),
    centroMedico: z.string().nullable().optional(),
  });

  if (!isDoctor) return base;

  return base
    .extend({
      nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
      rut: z.string().nullable().optional(),
      rutExempt: z.boolean().default(false),
      rutExemptReason: z.string().nullable().optional(),
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
