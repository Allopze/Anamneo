'use client';

import Link from 'next/link';
import { FiAlertCircle, FiEdit2, FiExternalLink } from 'react-icons/fi';
import { parseHistoryField } from '@/lib/utils';
import { AnamnesisRemotaData } from '@/types';
import { SectionBlock, SectionCallout } from '@/components/sections/SectionPrimitives';

interface Props {
  data: AnamnesisRemotaData;
  onChange: (data: AnamnesisRemotaData) => void;
  readOnly?: boolean;
  patientId?: string;
  canEditPatientHistory?: boolean;
}

const HISTORY_FIELDS = [
  { key: 'antecedentesMedicos', label: 'Antecedentes médicos' },
  { key: 'antecedentesQuirurgicos', label: 'Antecedentes quirúrgicos' },
  { key: 'antecedentesGinecoobstetricos', label: 'Antecedentes ginecoobstétricos' },
  { key: 'antecedentesFamiliares', label: 'Antecedentes familiares' },
  { key: 'habitos', label: 'Hábitos' },
  { key: 'medicamentos', label: 'Uso de medicamentos' },
  { key: 'alergias', label: 'Alergias' },
  { key: 'inmunizaciones', label: 'Inmunizaciones' },
  { key: 'antecedentesSociales', label: 'Antecedentes sociales' },
  { key: 'antecedentesPersonales', label: 'Antecedentes personales' },
];

const HISTORY_GROUPS = [
  {
    title: 'Antecedentes clínicos',
    fields: [
      'antecedentesMedicos',
      'antecedentesQuirurgicos',
      'antecedentesGinecoobstetricos',
      'antecedentesFamiliares',
    ],
  },
  {
    title: 'Medicaciones, alergias y hábitos',
    fields: ['habitos', 'medicamentos', 'alergias', 'inmunizaciones'],
  },
  {
    title: 'Contexto personal y social',
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

  const renderField = (key: string, label: string) => {
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
        />
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {isReadOnlyFromHistory && (
        <SectionCallout
          tone="warning"
          title="Antecedentes traídos desde la ficha del paciente"
          actions={!readOnly ? (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button
                type="button"
                onClick={handleEnableEdit}
                className="btn btn-primary min-h-10 gap-2 rounded-lg px-3 py-2 text-sm"
              >
                <FiEdit2 className="w-4 h-4" />
                Editar solo en esta atención
              </button>
              {patientId && canEditPatientHistory && (
                <Link
                  href={`/pacientes/${patientId}/historial`}
                  className="btn btn-secondary min-h-10 gap-2 rounded-lg px-3 py-2 text-sm"
                >
                  <FiExternalLink className="h-4 w-4" />
                  Abrir ficha del paciente
                </Link>
              )}
            </div>
          ) : undefined}
        >
          <div className="flex items-start gap-2">
            <FiAlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              Estos antecedentes vienen guardados desde la ficha del paciente. Si los editas aquí,
              el cambio quedará solo en esta atención y no actualizará la ficha del paciente.
            </p>
          </div>
        </SectionCallout>
      )}

      {HISTORY_GROUPS.map((group) => (
        <SectionBlock
          key={group.title}
          title={group.title}
        >
          <div className="space-y-4">
            {group.fields.map((fieldKey) => {
              const field = HISTORY_FIELDS.find((item) => item.key === fieldKey);
              if (!field) return null;
              return renderField(field.key, field.label);
            })}
          </div>
        </SectionBlock>
      ))}
    </div>
  );
}
