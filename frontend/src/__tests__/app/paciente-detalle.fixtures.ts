export const basePatientResponse = {
  id: 'patient-1',
  rut: '11.111.111-1',
  rutExempt: false,
  rutExemptReason: null,
  nombre: 'Paciente Demo',
  edad: 44,
  sexo: 'FEMENINO',
  trabajo: null,
  prevision: 'FONASA',
  registrationMode: 'COMPLETO',
  completenessStatus: 'VERIFICADA',
  demographicsVerifiedAt: '2026-03-31T08:00:00.000Z',
  demographicsVerifiedById: 'user-1',
  demographicsMissingFields: [],
  domicilio: null,
  centroMedico: 'Centro Integral Norte',
  createdAt: '2026-03-31T08:00:00.000Z',
  updatedAt: '2026-03-31T08:00:00.000Z',
  history: {},
  problems: [],
  tasks: [],
};

export const baseEncounterListPage1 = {
  data: [
    {
      id: 'enc-1',
      patientId: 'patient-1',
      createdById: 'user-1',
      status: 'COMPLETADO',
      reviewStatus: 'REVISADA_POR_MEDICO',
      createdAt: '2026-03-31T08:00:00.000Z',
      updatedAt: '2026-03-31T08:30:00.000Z',
      createdBy: { id: 'user-1', nombre: 'Dra. Rivera' },
      progress: { completed: 10, total: 10 },
      sections: [],
      tasks: [],
    },
  ],
  pagination: {
    page: 1,
    limit: 10,
    total: 2,
    totalPages: 2,
  },
};

export const baseEncounterListPage2 = {
  data: [
    {
      id: 'enc-2',
      patientId: 'patient-1',
      createdById: 'user-1',
      status: 'EN_PROGRESO',
      reviewStatus: 'NO_REQUIERE_REVISION',
      createdAt: '2026-03-30T10:00:00.000Z',
      updatedAt: '2026-03-30T10:20:00.000Z',
      createdBy: { id: 'user-1', nombre: 'Dra. Rivera' },
      progress: { completed: 3, total: 10 },
      sections: [],
      tasks: [],
    },
  ],
  pagination: {
    page: 2,
    limit: 10,
    total: 2,
    totalPages: 2,
  },
};

export const baseClinicalSummary = {
  patientId: 'patient-1',
  generatedAt: '2026-03-31T09:00:00.000Z',
  counts: {
    totalEncounters: 2,
    activeProblems: 1,
    pendingTasks: 1,
  },
  latestEncounterSummary: {
    encounterId: 'enc-1',
    createdAt: '2026-03-31T08:00:00.000Z',
    lines: ['Dx: Migraña', 'Resumen: Paciente en mejoría.'],
  },
  vitalTrend: [
    {
      encounterId: 'enc-1',
      createdAt: '2026-03-31T08:00:00.000Z',
      presionArterial: '120/80',
      peso: 70,
      imc: 24.2,
      temperatura: 36.5,
      saturacionOxigeno: 98,
    },
  ],
  recentDiagnoses: [
    {
      label: 'Migraña',
      count: 2,
      lastSeenAt: '2026-03-31T08:00:00.000Z',
    },
  ],
  activeProblems: [],
  pendingTasks: [],
};

export const emptyClinicalSummary = {
  patientId: 'patient-1',
  generatedAt: '2026-03-31T09:00:00.000Z',
  counts: { totalEncounters: 0, activeProblems: 0, pendingTasks: 0 },
  latestEncounterSummary: null,
  vitalTrend: [],
  recentDiagnoses: [],
  activeProblems: [],
  pendingTasks: [],
};

export const emptyEncounterList = {
  data: [],
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
};

export const baseOperationalHistory = [
  {
    id: 'op-1',
    timestamp: '2026-03-31T09:00:00.000Z',
    reason: 'PATIENT_RESTORED',
    label: 'Restauración de paciente',
    detail: 'Se reabrieron 1 atenciones que habían sido canceladas por el archivado.',
    userName: 'Dra. Rivera',
    encounterId: null,
    encounterCreatedAt: null,
  },
  {
    id: 'op-2',
    timestamp: '2026-03-31T09:05:00.000Z',
    reason: 'ENCOUNTER_REOPENED',
    label: 'Reapertura de atención',
    detail: 'La atención volvió a estado en progreso al restaurar la ficha del paciente.',
    userName: 'Dra. Rivera',
    encounterId: 'enc-1',
    encounterCreatedAt: '2026-03-31T08:00:00.000Z',
  },
];
