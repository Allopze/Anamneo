import { render, screen } from '@testing-library/react';

import PatientLongitudinalSummaryCard from '@/app/(dashboard)/pacientes/[id]/PatientLongitudinalSummaryCard';
import type { Patient, PatientClinicalSummary } from '@/types';

describe('PatientLongitudinalSummaryCard', () => {
  it('renders structured allergy and medication history entries', () => {
    const patient = {
      id: 'patient-1',
      nombre: 'Paciente Demo',
      history: {
        alergias: JSON.stringify({ items: ['Penicilina', 'Látex'], texto: 'Reacción cutánea' }),
        medicamentos: JSON.stringify({ items: ['Omeprazol'], texto: '20 mg por la mañana' }),
      },
    } as Patient;

    const clinicalSummary = {
      patientId: 'patient-1',
      generatedAt: '2026-04-22T12:00:00.000Z',
      counts: { totalEncounters: 2, activeProblems: 0, pendingTasks: 0 },
      latestEncounterSummary: null,
      vitalTrend: [],
      recentDiagnoses: [],
      activeProblems: [],
      pendingTasks: [],
    } as PatientClinicalSummary;

    render(<PatientLongitudinalSummaryCard patient={patient} clinicalSummary={clinicalSummary} />);

    expect(screen.getByText('Alergias y medicación')).toBeInTheDocument();
    expect(screen.getByText('Penicilina')).toBeInTheDocument();
    expect(screen.getByText('Látex')).toBeInTheDocument();
    expect(screen.getByText('Reacción cutánea')).toBeInTheDocument();
    expect(screen.getByText('Omeprazol')).toBeInTheDocument();
    expect(screen.getByText('20 mg por la mañana')).toBeInTheDocument();
  });
});