import { listVitalSignAssessments } from '../../../shared/vital-sign-alerts';
import { formatHistoryFieldText } from './clinical';
import type { Patient, PatientClinicalSummary } from '@/types';

export interface ClinicalAlertItem {
  type: 'warning' | 'info';
  label: string;
  value: string;
}

type PatientClinicalContext = Pick<Patient, 'history' | 'problems' | 'tasks'>;

export function buildClinicalAlertItems(
  patient: PatientClinicalContext | null | undefined,
  clinicalSummary?: Pick<PatientClinicalSummary, 'vitalTrend'> | null,
) {
  const alerts: ClinicalAlertItem[] = [];

  const alergias = formatHistoryFieldText(patient?.history?.alergias);
  const medicamentos = formatHistoryFieldText(patient?.history?.medicamentos);
  const antecedentesMedicos = formatHistoryFieldText(patient?.history?.antecedentesMedicos);

  if (alergias) alerts.push({ type: 'warning', label: 'Alergias', value: alergias });
  if (medicamentos) alerts.push({ type: 'info', label: 'Medicación habitual', value: medicamentos });
  if (antecedentesMedicos) alerts.push({ type: 'info', label: 'Antecedentes', value: antecedentesMedicos });

  const activeProblems = (patient?.problems ?? []).filter((problem) => problem.status !== 'RESUELTO');
  if (activeProblems.length > 0) {
    alerts.push({
      type: 'info',
      label: 'Problemas activos',
      value: activeProblems.slice(0, 3).map((problem) => problem.label).join(', '),
    });
  }

  const pendingTasks = (patient?.tasks ?? []).filter(
    (task) => task.status === 'PENDIENTE' || task.status === 'EN_PROCESO',
  );
  if (pendingTasks.length > 0) {
    alerts.push({
      type: 'warning',
      label: 'Seguimientos pendientes',
      value: pendingTasks.slice(0, 2).map((task) => task.title).join(', '),
    });
  }

  const latestVitals = clinicalSummary?.vitalTrend?.[0];
  if (latestVitals) {
    listVitalSignAssessments({
      presionArterial: latestVitals.presionArterial ?? undefined,
      temperatura: latestVitals.temperatura !== null ? String(latestVitals.temperatura) : undefined,
      saturacionOxigeno: latestVitals.saturacionOxigeno !== null ? String(latestVitals.saturacionOxigeno) : undefined,
    }).forEach((assessment) => {
      alerts.push({
        type: 'warning',
        label: assessment.summary,
        value: assessment.primaryDetail,
      });
    });
  }

  return alerts;
}