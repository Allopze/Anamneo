import { z } from 'zod';

export const PROBLEM_STATUSES = ['ACTIVO', 'CRONICO', 'EN_ESTUDIO', 'RESUELTO'] as const;
export const TASK_TYPES = ['SEGUIMIENTO', 'EXAMEN', 'DERIVACION', 'TRAMITE'] as const;

export const problemSchema = z.object({
  label: z.string().min(2, 'Mínimo 2 caracteres').max(160, 'Máximo 160 caracteres'),
  notes: z.string().max(1000, 'Máximo 1000 caracteres').optional().or(z.literal('')),
  status: z.enum(PROBLEM_STATUSES),
});
export type ProblemForm = z.infer<typeof problemSchema>;

export const taskSchema = z.object({
  title: z.string().min(2, 'Mínimo 2 caracteres').max(160, 'Máximo 160 caracteres'),
  details: z.string().max(1200, 'Máximo 1200 caracteres').optional().or(z.literal('')),
  type: z.enum(TASK_TYPES),
  dueDate: z.string().optional().or(z.literal('')),
});
export type TaskForm = z.infer<typeof taskSchema>;

export const VITAL_CHART_CONFIG = [
  { key: 'peso' as const, label: 'Peso', unit: 'kg', stroke: '#0f766e' },
  { key: 'imc' as const, label: 'IMC', unit: '', stroke: '#7c3aed' },
  { key: 'temperatura' as const, label: 'T°', unit: '°C', stroke: '#ea580c' },
  { key: 'saturacionOxigeno' as const, label: 'SatO₂', unit: '%', stroke: '#2563eb' },
] as const;
export type VitalKey = (typeof VITAL_CHART_CONFIG)[number]['key'];
