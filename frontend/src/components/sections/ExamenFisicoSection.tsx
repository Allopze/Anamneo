'use client';

import { ExamenFisicoData } from '@/types';
import { SectionBlock, SectionIntro } from '@/components/sections/SectionPrimitives';

interface Props {
  data: ExamenFisicoData;
  onChange: (data: ExamenFisicoData) => void;
  readOnly?: boolean;
}

const BODY_PARTS = [
  { key: 'cabeza', label: 'Cabeza' },
  { key: 'cuello', label: 'Cuello' },
  { key: 'torax', label: 'Tórax' },
  { key: 'abdomen', label: 'Abdomen' },
  { key: 'extremidades', label: 'Extremidades' },
];

function calculateImc(signosVitales: Record<string, string | undefined>): string | undefined {
  const peso = parseFloat(signosVitales.peso || '');
  const talla = parseFloat(signosVitales.talla || '') / 100; // cm to m
  if (peso > 0 && talla > 0) {
    return (peso / (talla * talla)).toFixed(1);
  }
  return undefined;
}

export default function ExamenFisicoSection({ data, onChange, readOnly }: Props) {
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

  return (
    <div className="space-y-5">
      <SectionIntro description="Registra signos vitales y hallazgos del examen segmentario usando el mismo orden en cada atención." />

      <SectionBlock title="Signos vitales" description="Constantes fisiológicas y antropometría básica para seguimiento clínico.">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <label className="form-label">PA (mmHg)</label>
            <input
              type="text"
              value={signosVitales.presionArterial || ''}
              onChange={(e) => handleVitalSign('presionArterial', e.target.value)}
              disabled={readOnly}
              className="form-input"
              placeholder="120/80"
            />
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
              className="form-input"
              placeholder="72"
            />
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
              className="form-input"
              placeholder="16"
            />
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
              className="form-input"
              placeholder="36.5"
            />
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
              className="form-input"
              placeholder="98"
            />
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
              className="form-input bg-slate-50"
            />
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
                  className="form-input resize-none"
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
