'use client';

import Link from 'next/link';
import { FiAlertCircle, FiEdit2 } from 'react-icons/fi';
import { parseHistoryField } from '@/lib/utils';
import { AnamnesisRemotaData } from '@/types';
import { SectionBlock, SectionCallout, SectionIntro } from '@/components/sections/SectionPrimitives';

interface Props {
  data: AnamnesisRemotaData;
  onChange: (data: AnamnesisRemotaData) => void;
  readOnly?: boolean;
  patientId?: string;
  canEditPatientHistory?: boolean;
}

const HISTORY_FIELDS = [
  { key: 'antecedentesMedicos', label: 'Antecedentes médicos', placeholder: 'Enfermedades crónicas, hospitalizaciones previas...' },
  { key: 'antecedentesQuirurgicos', label: 'Antecedentes quirúrgicos', placeholder: 'Cirugías previas, fechas aproximadas...' },
  { key: 'antecedentesGinecoobstetricos', label: 'Antecedentes ginecoobstétricos', placeholder: 'Menarquia, embarazos, menopausia...' },
  { key: 'antecedentesFamiliares', label: 'Antecedentes familiares', placeholder: 'Enfermedades hereditarias, causas de muerte de familiares...' },
  { key: 'habitos', label: 'Hábitos', placeholder: 'Tabaco, alcohol, drogas, ejercicio, alimentación...' },
  { key: 'medicamentos', label: 'Uso de medicamentos', placeholder: 'Medicamentos actuales, dosis, frecuencia...' },
  { key: 'alergias', label: 'Alergias', placeholder: 'Medicamentos, alimentos, ambientales...' },
  { key: 'inmunizaciones', label: 'Inmunizaciones', placeholder: 'Vacunas recibidas, fechas...' },
  { key: 'antecedentesSociales', label: 'Antecedentes sociales', placeholder: 'Vivienda, trabajo, relaciones, situación económica...' },
  { key: 'antecedentesPersonales', label: 'Antecedentes personales', placeholder: 'Otros datos relevantes del paciente...' },
];

const HISTORY_GROUPS = [
  {
    title: 'Antecedentes clínicos',
    description: 'Condiciones previas, cirugías y antecedentes familiares relevantes.',
    fields: [
      'antecedentesMedicos',
      'antecedentesQuirurgicos',
      'antecedentesGinecoobstetricos',
      'antecedentesFamiliares',
    ],
  },
  {
    title: 'Medicaciones, alergias y hábitos',
    description: 'Factores que impactan tratamiento, riesgo y conducta clínica.',
    fields: ['habitos', 'medicamentos', 'alergias', 'inmunizaciones'],
  },
  {
    title: 'Contexto personal y social',
    description: 'Información útil para continuidad, adherencia y entorno del paciente.',
    fields: ['antecedentesSociales', 'antecedentesPersonales'],
  },
] as const;

export default function AnamnesisRemotaSection({
  data,
  onChange,
  readOnly,
  patientId,
  canEditPatientHistory = false,
}: Props) {
  const isReadOnlyFromHistory = data.readonly === true;
  const effectiveReadOnly = readOnly || isReadOnlyFromHistory;

  const handleChange = (field: string, value: string) => {
    const current = parseHistoryField(data[field as keyof AnamnesisRemotaData]);
    onChange({
      ...data,
      [field]: {
        ...(Array.isArray(current?.items) && current.items.length > 0 ? { items: current.items } : {}),
        texto: value,
      },
      readonly: false,
    });
  };

  const handleEnableEdit = () => {
    onChange({ ...data, readonly: false });
  };

  const renderField = (key: string, label: string, placeholder: string) => {
    const fieldKey = key as keyof AnamnesisRemotaData;
    const rawVal = data[fieldKey];
    const val = parseHistoryField(rawVal);
    const hasItems = val?.items?.length > 0;

    return (
      <div key={key} className="space-y-2">
        <label className="form-label">{label}</label>

        {hasItems && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {val.items.map((item: string) => (
              <span
                key={item}
                className="inline-flex items-center rounded-full border border-surface-muted/30 bg-surface-muted px-2 py-0.5 text-xs text-ink-secondary"
              >
                {item}
              </span>
            ))}
          </div>
        )}

        <textarea
          value={typeof val === 'object' ? val?.texto || '' : val || ''}
          onChange={(e) => handleChange(key, e.target.value)}
          disabled={effectiveReadOnly}
          rows={2}
          className="form-input form-textarea"
          placeholder={placeholder}
        />
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <SectionIntro description="Antecedentes remotos cargados desde el historial del paciente. Si necesitas contextualizarlos para esta atención, primero desacopla el snapshot local; si necesitas cambiar el historial permanente, hazlo desde la ficha del paciente." />

      {isReadOnlyFromHistory && (
        <SectionCallout
          tone="warning"
          title="Snapshot cargado desde el historial del paciente"
          actions={!readOnly ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleEnableEdit}
                className="inline-flex items-center gap-1 text-sm font-medium text-accent-text hover:text-ink"
              >
                <FiEdit2 className="w-4 h-4" />
                Editar solo esta atención
              </button>
              {patientId && canEditPatientHistory && (
                <Link
                  href={`/pacientes/${patientId}/historial`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-accent-text hover:text-ink"
                >
                  Ir al historial maestro
                </Link>
              )}
            </div>
          ) : undefined}
        >
          <div className="flex items-start gap-2">
            <FiAlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              Esta información proviene del historial del paciente. Si la editas aquí,
              el cambio quedará solo en esta atención y ya no seguirá sincronizado con la ficha maestra.
            </p>
          </div>
        </SectionCallout>
      )}

      {HISTORY_GROUPS.map((group) => (
        <SectionBlock
          key={group.title}
          title={group.title}
          description={group.description}
        >
          <div className="space-y-4">
            {group.fields.map((fieldKey) => {
              const field = HISTORY_FIELDS.find((item) => item.key === fieldKey);
              if (!field) return null;
              return renderField(field.key, field.label, field.placeholder);
            })}
          </div>
        </SectionBlock>
      ))}
    </div>
  );
}
