export interface TemplateVariableContext {
  patientName?: string;
  patientRut?: string;
  encounterDate?: string;
  doctorName?: string;
  patientAge?: number | string;
}

const BLANK = '___________';
const BLANK_SHORT = '___';

function todayFormatted(): string {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());
}

export function resolveTemplateVariables(content: string, ctx: TemplateVariableContext = {}): string {
  const today = todayFormatted();
  return content
    .replace(/\{\{nombre_paciente\}\}/g, ctx.patientName ?? BLANK)
    .replace(/\{\{rut_paciente\}\}/g, ctx.patientRut ?? BLANK)
    .replace(/\{\{fecha_atencion\}\}/g, ctx.encounterDate ?? today)
    .replace(/\{\{medico_nombre\}\}/g, ctx.doctorName ?? BLANK)
    .replace(/\{\{edad_paciente\}\}/g, ctx.patientAge != null ? String(ctx.patientAge) : BLANK_SHORT)
    .replace(/\{\{fecha_actual\}\}/g, today);
}

export const TEMPLATE_VARIABLE_HINTS: Array<{ variable: string; description: string }> = [
  { variable: '{{nombre_paciente}}', description: 'Nombre completo del paciente' },
  { variable: '{{rut_paciente}}', description: 'RUT del paciente' },
  { variable: '{{fecha_atencion}}', description: 'Fecha de la atención actual' },
  { variable: '{{medico_nombre}}', description: 'Nombre del médico tratante' },
  { variable: '{{edad_paciente}}', description: 'Edad del paciente' },
  { variable: '{{fecha_actual}}', description: 'Fecha de hoy' },
];
