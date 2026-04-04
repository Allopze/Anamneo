'use client';

import { FiAlertTriangle } from 'react-icons/fi';
import clsx from 'clsx';
import { ExamenFisicoData, Patient } from '@/types';
import { SectionBlock, SectionIntro } from '@/components/sections/SectionPrimitives';
import { getBmiInterpretation } from '@/lib/bmi';

interface Props {
  data: ExamenFisicoData;
  onChange: (data: ExamenFisicoData) => void;
  readOnly?: boolean;
  patientAge?: number;
  patientSexo?: Patient['sexo'];
}

const BODY_PARTS = [
  { key: 'cabeza', label: 'Cabeza' },
  { key: 'cuello', label: 'Cuello' },
  { key: 'torax', label: 'Tórax' },
  { key: 'abdomen', label: 'Abdomen' },
  { key: 'extremidades', label: 'Extremidades' },
];

const ESTADO_GENERAL_OPTIONS = [
  { value: '', label: 'Sin registrar' },
  { value: 'BUEN_ESTADO', label: 'Buen estado general' },
  { value: 'REGULAR_ESTADO', label: 'Regular estado general' },
  { value: 'MAL_ESTADO', label: 'Mal estado general' },
];

interface VitalAlert {
  message: string;
  severity: 'warning' | 'danger';
}

function getVitalAlerts(signosVitales: Record<string, string | undefined>): Record<string, VitalAlert> {
  const alerts: Record<string, VitalAlert> = {};

  // Blood pressure
  const pa = signosVitales.presionArterial;
  if (pa) {
    const match = pa.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (match) {
      const sys = parseInt(match[1], 10);
      const dia = parseInt(match[2], 10);
      if (sys >= 180 || dia >= 120) {
        alerts.presionArterial = { message: 'Crisis hipertensiva', severity: 'danger' };
      } else if (sys >= 140 || dia >= 90) {
        alerts.presionArterial = { message: 'Hipertensión', severity: 'warning' };
      } else if (sys < 90 || dia < 60) {
        alerts.presionArterial = { message: 'Hipotensión', severity: 'warning' };
      }
    }
  }

  // Heart rate
  const fc = parseFloat(signosVitales.frecuenciaCardiaca || '');
  if (fc) {
    if (fc > 120) {
      alerts.frecuenciaCardiaca = { message: 'Taquicardia significativa', severity: 'danger' };
    } else if (fc > 100) {
      alerts.frecuenciaCardiaca = { message: 'Taquicardia', severity: 'warning' };
    } else if (fc < 50) {
      alerts.frecuenciaCardiaca = { message: 'Bradicardia', severity: 'warning' };
    }
  }

  // Respiratory rate
  const fr = parseFloat(signosVitales.frecuenciaRespiratoria || '');
  if (fr) {
    if (fr > 24) {
      alerts.frecuenciaRespiratoria = { message: 'Taquipnea', severity: 'warning' };
    } else if (fr < 10) {
      alerts.frecuenciaRespiratoria = { message: 'Bradipnea', severity: 'danger' };
    }
  }

  // Temperature
  const temp = parseFloat(signosVitales.temperatura || '');
  if (temp) {
    if (temp >= 39) {
      alerts.temperatura = { message: 'Fiebre alta', severity: 'danger' };
    } else if (temp >= 38) {
      alerts.temperatura = { message: 'Fiebre', severity: 'warning' };
    } else if (temp < 35) {
      alerts.temperatura = { message: 'Hipotermia', severity: 'danger' };
    }
  }

  // SpO2
  const sat = parseFloat(signosVitales.saturacionOxigeno || '');
  if (sat) {
    if (sat < 90) {
      alerts.saturacionOxigeno = { message: 'Hipoxemia severa', severity: 'danger' };
    } else if (sat < 92) {
      alerts.saturacionOxigeno = { message: 'Hipoxemia', severity: 'warning' };
    }
  }

  return alerts;
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

function calculateImc(signosVitales: Record<string, string | undefined>): string | undefined {
  const peso = parseFloat(signosVitales.peso || '');
  const talla = parseFloat(signosVitales.talla || '') / 100; // cm to m
  if (peso > 0 && talla > 0) {
    return (peso / (talla * talla)).toFixed(1);
  }
  return undefined;
}

export default function ExamenFisicoSection({
  data,
  onChange,
  readOnly,
  patientAge,
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
    ageYears: patientAge,
    sex: patientSexo,
  });
  const vitalAlerts = getVitalAlerts(signosVitales as Record<string, string | undefined>);
  const hasAnyAlert = Object.keys(vitalAlerts).length > 0;

  return (
    <div className="space-y-5">
      <SectionIntro description="Registra signos vitales y hallazgos del examen segmentario usando el mismo orden en cada atención." />

      <SectionBlock title="Estado general" description="Impresión global del paciente al momento de la evaluación.">
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

      <SectionBlock title="Signos vitales" description="Constantes fisiológicas y antropometría básica para seguimiento clínico.">
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

      <SectionBlock title="Examen segmentario" description="Describe los hallazgos positivos o negativos relevantes por zona anatómica.">
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
