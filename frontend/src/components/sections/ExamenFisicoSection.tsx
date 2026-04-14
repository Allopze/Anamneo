'use client';

import { FiAlertTriangle } from 'react-icons/fi';
import clsx from 'clsx';
import { ExamenFisicoData, Patient } from '@/types';
import { SectionBlock } from '@/components/sections/SectionPrimitives';
import { getBmiInterpretation } from '@/lib/bmi';
import {
  BODY_PARTS,
  ESTADO_GENERAL_OPTIONS,
  VitalAlert,
  getVitalAlerts,
  calculateImc,
} from './examen-fisico.constants';

interface Props {
  data: ExamenFisicoData;
  onChange: (data: ExamenFisicoData) => void;
  readOnly?: boolean;
  patientAge?: number;
  patientAgeMonths?: number;
  patientSexo?: Patient['sexo'];
}

function VitalAlertBadge({ alert }: { alert: VitalAlert }) {
  return (
    <p
      className={clsx(
        'mt-1.5 flex items-center gap-1.5 text-xs font-medium',
        alert.severity === 'danger' ? 'text-status-red-text' : 'text-status-yellow-text',
      )}
    >
      <FiAlertTriangle className="h-3 w-3 shrink-0" />
      {alert.message}
    </p>
  );
}

export default function ExamenFisicoSection({
  data,
  onChange,
  readOnly,
  patientAge,
  patientAgeMonths,
  patientSexo,
}: Props) {
  const handleChange = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const handleVitalSign = (field: string, value: string) => {
    const signosVitales = { ...(data.signosVitales || {}), [field]: value };
    // Recalculate IMC whenever peso or talla changes
    if (field === 'peso' || field === 'talla') {
      const imc = calculateImc(signosVitales);
      if (imc !== undefined) {
        signosVitales.imc = imc;
      }
    }
    onChange({ ...data, signosVitales });
  };

  const signosVitales = data.signosVitales || {};
  const bmiInterpretation = getBmiInterpretation({
    weightKg: signosVitales.peso,
    heightCm: signosVitales.talla,
    ageYears: patientAge != null ? patientAge + (patientAgeMonths ?? 0) / 12 : undefined,
    sex: patientSexo,
  });
  const vitalAlerts = getVitalAlerts(signosVitales as Record<string, string | undefined>);
  const hasAnyAlert = Object.keys(vitalAlerts).length > 0;

  return (
    <div className="space-y-5">
      <SectionBlock title="Estado general">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="form-label">Impresión general</label>
            <select
              value={data.estadoGeneral || ''}
              onChange={(e) => handleChange('estadoGeneral', e.target.value)}
              disabled={readOnly}
              className="form-input"
            >
              {ESTADO_GENERAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Notas estado general</label>
            <input
              type="text"
              value={data.estadoGeneralNotas || ''}
              onChange={(e) => handleChange('estadoGeneralNotas', e.target.value)}
              disabled={readOnly}
              className="form-input"
              placeholder="Ej: lúcido, orientado, hidratado…"
            />
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="Signos vitales">
        {hasAnyAlert && (
          <div className="mb-4 flex items-start gap-2 rounded-card border border-status-red/30 bg-status-red/8 px-4 py-3">
            <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-red-text" />
            <div className="text-sm text-status-red-text">
              <p className="font-medium">Signos vitales fuera de rango</p>
              <p className="mt-1 text-xs">
                {Object.values(vitalAlerts).map((a) => a.message).join(' · ')}
              </p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <label className="form-label">PA (mmHg)</label>
            <input
              type="text"
              value={signosVitales.presionArterial || ''}
              onChange={(e) => handleVitalSign('presionArterial', e.target.value)}
              disabled={readOnly}
              className={clsx('form-input', vitalAlerts.presionArterial && 'border-status-red/60')}
              placeholder="120/80"
            />
            {vitalAlerts.presionArterial && <VitalAlertBadge alert={vitalAlerts.presionArterial} />}
          </div>
          <div>
            <label className="form-label">FC (lpm)</label>
            <input
              type="number"
              min={20}
              max={250}
              value={signosVitales.frecuenciaCardiaca || ''}
              onChange={(e) => handleVitalSign('frecuenciaCardiaca', e.target.value)}
              disabled={readOnly}
              className={clsx('form-input', vitalAlerts.frecuenciaCardiaca && 'border-status-red/60')}
              placeholder="72"
            />
            {vitalAlerts.frecuenciaCardiaca && <VitalAlertBadge alert={vitalAlerts.frecuenciaCardiaca} />}
          </div>
          <div>
            <label className="form-label">FR (rpm)</label>
            <input
              type="number"
              min={5}
              max={60}
              value={signosVitales.frecuenciaRespiratoria || ''}
              onChange={(e) => handleVitalSign('frecuenciaRespiratoria', e.target.value)}
              disabled={readOnly}
              className={clsx('form-input', vitalAlerts.frecuenciaRespiratoria && 'border-status-red/60')}
              placeholder="16"
            />
            {vitalAlerts.frecuenciaRespiratoria && <VitalAlertBadge alert={vitalAlerts.frecuenciaRespiratoria} />}
          </div>
          <div>
            <label className="form-label">T° (°C)</label>
            <input
              type="number"
              step="0.1"
              min={35}
              max={42}
              value={signosVitales.temperatura || ''}
              onChange={(e) => handleVitalSign('temperatura', e.target.value)}
              disabled={readOnly}
              className={clsx('form-input', vitalAlerts.temperatura && 'border-status-red/60')}
              placeholder="36.5"
            />
            {vitalAlerts.temperatura && <VitalAlertBadge alert={vitalAlerts.temperatura} />}
          </div>
          <div>
            <label className="form-label">SatO2 (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={signosVitales.saturacionOxigeno || ''}
              onChange={(e) => handleVitalSign('saturacionOxigeno', e.target.value)}
              disabled={readOnly}
              className={clsx('form-input', vitalAlerts.saturacionOxigeno && 'border-status-red/60')}
              placeholder="98"
            />
            {vitalAlerts.saturacionOxigeno && <VitalAlertBadge alert={vitalAlerts.saturacionOxigeno} />}
          </div>
          <div>
            <label className="form-label">Peso (kg)</label>
            <input
              type="number"
              step="0.1"
              min={0.5}
              max={500}
              value={signosVitales.peso || ''}
              onChange={(e) => handleVitalSign('peso', e.target.value)}
              disabled={readOnly}
              className="form-input"
              placeholder="70"
            />
          </div>
          <div>
            <label className="form-label">Talla (cm)</label>
            <input
              type="number"
              min={20}
              max={250}
              value={signosVitales.talla || ''}
              onChange={(e) => handleVitalSign('talla', e.target.value)}
              disabled={readOnly}
              className="form-input"
              placeholder="170"
            />
          </div>
          <div>
            <label className="form-label">IMC (calculado)</label>
            <input
              type="text"
              value={signosVitales.imc || '--'}
              disabled
              className="form-input bg-surface-base/40"
            />
            {bmiInterpretation ? (
              <p className="mt-2 text-xs leading-5 text-ink-secondary">
                <span className="font-medium text-ink">{bmiInterpretation.reference}:</span>{' '}
                {bmiInterpretation.classification} ({bmiInterpretation.bmiLabel})
                {bmiInterpretation.note ? ` · ${bmiInterpretation.note}` : ''}
              </p>
            ) : (
              <p className="mt-2 text-xs leading-5 text-ink-muted">
                Ingresa peso y talla para calcular el IMC.
              </p>
            )}
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="Examen segmentario">
        <div className="space-y-4">
          {BODY_PARTS.map(({ key, label }) => {
            const fieldKey = key as keyof ExamenFisicoData;
            return (
              <div key={key}>
                <label className="form-label">{label}</label>
                <textarea
                  value={data[fieldKey] as string || ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  disabled={readOnly}
                  rows={2}
                  className="form-input form-textarea"
                  placeholder={`Hallazgos del examen de ${label.toLowerCase()}...`}
                />
              </div>
            );
          })}
        </div>
      </SectionBlock>
    </div>
  );
}
