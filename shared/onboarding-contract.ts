export const ONBOARDING_VERSION = 'clinical-v1' as const;

export type OnboardingVersion = typeof ONBOARDING_VERSION;
export type OnboardingRole = 'MEDICO' | 'ASISTENTE';

export type OnboardingStepId =
  | 'review_dashboard'
  | 'create_patient'
  | 'create_encounter'
  | 'complete_sections'
  | 'close_or_sign'
  | 'support_encounter'
  | 'review_followups'
  | 'attachments_and_alerts';

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}

export const ONBOARDING_ELIGIBLE_ROLES = ['MEDICO', 'ASISTENTE'] as const;

export const ONBOARDING_STEPS_BY_ROLE: Record<OnboardingRole, OnboardingStep[]> = {
  MEDICO: [
    {
      id: 'review_dashboard',
      title: 'Revisa tu inicio clínico',
      description: 'Ubica atenciones en curso, seguimientos y alertas operativas del día.',
      href: '/',
      actionLabel: 'Ir al inicio',
    },
    {
      id: 'create_patient',
      title: 'Crea tu primer paciente',
      description: 'Registra los datos mínimos antes de iniciar una atención clínica.',
      href: '/pacientes/nuevo',
      actionLabel: 'Nuevo paciente',
    },
    {
      id: 'create_encounter',
      title: 'Inicia una atención',
      description: 'Abre una ficha de atención y vincúlala al paciente correcto.',
      href: '/atenciones/nueva',
      actionLabel: 'Nueva atención',
    },
    {
      id: 'complete_sections',
      title: 'Completa secciones clínicas',
      description: 'Avanza por motivo, anamnesis, examen, diagnóstico y tratamiento.',
      href: '/atenciones',
      actionLabel: 'Ver atenciones',
    },
    {
      id: 'close_or_sign',
      title: 'Cierra o firma la atención',
      description: 'Finaliza el registro cuando la ficha esté lista para salida clínica.',
      href: '/atenciones',
      actionLabel: 'Continuar atención',
    },
  ],
  ASISTENTE: [
    {
      id: 'review_dashboard',
      title: 'Revisa tu inicio operativo',
      description: 'Ubica atenciones activas, pacientes recientes y tareas pendientes.',
      href: '/',
      actionLabel: 'Ir al inicio',
    },
    {
      id: 'create_patient',
      title: 'Crea o prepara pacientes',
      description: 'Registra datos administrativos y deja la ficha lista para el equipo clínico.',
      href: '/pacientes/nuevo',
      actionLabel: 'Nuevo paciente',
    },
    {
      id: 'support_encounter',
      title: 'Apoya una atención',
      description: 'Accede a atenciones permitidas y completa información operativa.',
      href: '/atenciones',
      actionLabel: 'Ver atenciones',
    },
    {
      id: 'review_followups',
      title: 'Revisa seguimientos',
      description: 'Ordena tareas por fecha, prioridad y tipo para no perder pendientes.',
      href: '/seguimientos',
      actionLabel: 'Abrir bandeja',
    },
    {
      id: 'attachments_and_alerts',
      title: 'Gestiona adjuntos y alertas',
      description: 'Usa la ficha del paciente para revisar documentos, consentimientos y alertas.',
      href: '/pacientes',
      actionLabel: 'Ver pacientes',
    },
  ],
};

export function isOnboardingRole(role: string | null | undefined): role is OnboardingRole {
  return role === 'MEDICO' || role === 'ASISTENTE';
}

export function getOnboardingStepsForRole(role: string | null | undefined): OnboardingStep[] {
  return isOnboardingRole(role) ? ONBOARDING_STEPS_BY_ROLE[role] : [];
}
