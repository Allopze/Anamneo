export const SEXO_MAP: Record<string, string> = {
  MASCULINO: 'Masculino',
  FEMENINO: 'Femenino',
  OTRO: 'Otro',
  PREFIERE_NO_DECIR: 'Prefiere no decir',
};

export const PREVISION_MAP: Record<string, string> = {
  FONASA: 'FONASA',
  ISAPRE: 'ISAPRE',
  OTRA: 'Otra',
  DESCONOCIDA: 'Desconocida',
};

export const ESTADO_GENERAL_MAP: Record<string, string> = {
  BUEN_ESTADO: 'Buen estado general',
  REGULAR_ESTADO: 'Regular estado general',
  MAL_ESTADO: 'Mal estado general',
};

export const STATUS_MAP: Record<string, string> = {
  EN_PROGRESO: 'En progreso',
  COMPLETADO: 'Completado',
  FIRMADO: 'Firmado',
  CANCELADO: 'Cancelado',
};

export const REVIEW_STATUS_MAP: Record<string, string> = {
  NO_REQUIERE_REVISION: 'Sin revision pendiente',
  LISTA_PARA_REVISION: 'Pendiente de revision medica',
  REVISADA_POR_MEDICO: 'Revisada por medico',
};

export const IDENTIFICATION_SNAPSHOT_FIELD_META = [
  { key: 'nombre', label: 'nombre' },
  { key: 'rut', label: 'RUT' },
  { key: 'rutExempt', label: 'exención de RUT' },
  { key: 'rutExemptReason', label: 'motivo de exención' },
  { key: 'edad', label: 'edad' },
  { key: 'edadMeses', label: 'edad (meses)' },
  { key: 'sexo', label: 'sexo' },
  { key: 'prevision', label: 'previsión' },
  { key: 'trabajo', label: 'trabajo' },
  { key: 'domicilio', label: 'domicilio' },
] as const;

export const ANAMNESIS_REMOTA_FIELD_LABELS: [string, string][] = [
  ['Antecedentes médicos', 'antecedentesMedicos'],
  ['Antecedentes quirúrgicos', 'antecedentesQuirurgicos'],
  ['Antecedentes ginecoobstétricos', 'antecedentesGinecoobstetricos'],
  ['Antecedentes familiares', 'antecedentesFamiliares'],
  ['Hábitos', 'habitos'],
  ['Medicamentos', 'medicamentos'],
  ['Alergias', 'alergias'],
  ['Inmunizaciones', 'inmunizaciones'],
  ['Antecedentes sociales', 'antecedentesSociales'],
  ['Antecedentes personales', 'antecedentesPersonales'],
];
