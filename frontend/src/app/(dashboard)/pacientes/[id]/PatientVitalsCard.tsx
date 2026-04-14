import { FiActivity } from 'react-icons/fi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import MiniTrendChart from '@/components/common/MiniTrendChart';
import type { PatientClinicalSummary } from '@/types';
import { VITAL_CHART_CONFIG, type VitalKey } from './patient-detail.constants';
import type { PatientDetailHook } from './usePatientDetail';

type Props = Pick<
  PatientDetailHook,
  'vitalTrend' | 'showFullVitals' | 'setShowFullVitals' | 'selectedVitalKey' | 'setSelectedVitalKey'
> & {
  clinicalSummary: PatientClinicalSummary | undefined;
};

export default function PatientVitalsCard({
  clinicalSummary,
  vitalTrend,
  showFullVitals,
  setShowFullVitals,
  selectedVitalKey,
  setSelectedVitalKey,
}: Props) {
  const strokeColor = VITAL_CHART_CONFIG.find((c) => c.key === selectedVitalKey)?.stroke ?? '#0f766e';
  const chartLabel: Record<VitalKey, string> = {
    peso: 'Peso (kg)',
    imc: 'IMC',
    temperatura: 'Temperatura (°C)',
    saturacionOxigeno: 'Saturación O₂ (%)',
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FiActivity className="w-5 h-5 text-accent-text" />
          <h2 className="text-lg font-bold text-ink">Tendencias clínicas</h2>
        </div>
        {vitalTrend.length > 0 && (
          <button
            type="button"
            className="text-xs font-medium text-accent-text hover:text-ink transition-colors"
            onClick={() => setShowFullVitals((prev: boolean) => !prev)}
          >
            {showFullVitals ? 'Ver resumen' : 'Ver historial completo'}
          </button>
        )}
      </div>

      {clinicalSummary?.recentDiagnoses?.length ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {clinicalSummary.recentDiagnoses.map((diagnosis) => (
            <span
              key={diagnosis.label}
              className="rounded-full border border-status-yellow/60 bg-status-yellow/30 px-3 py-1 text-xs font-medium text-accent-text"
            >
              {diagnosis.label} · {diagnosis.count}
            </span>
          ))}
        </div>
      ) : null}

      {vitalTrend.length > 0 ? (
        <div className="space-y-3">
          {showFullVitals && (
            <div className="flex flex-wrap gap-1.5">
              {VITAL_CHART_CONFIG.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedVitalKey === key
                      ? 'bg-accent-text text-surface-base'
                      : 'bg-surface-muted/40 text-ink-muted hover:text-ink'
                  }`}
                  onClick={() => setSelectedVitalKey(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {showFullVitals ? (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
                {chartLabel[selectedVitalKey]} ·{' '}
                {vitalTrend.filter((item) => item[selectedVitalKey] !== null).length} registros
              </p>
              <MiniTrendChart
                values={vitalTrend
                  .map((item) => item[selectedVitalKey])
                  .filter((value): value is number => value !== null)}
                height={80}
                stroke={strokeColor}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">Peso</p>
                <MiniTrendChart
                  values={vitalTrend.map((item) => item.peso).filter((value): value is number => value !== null)}
                  stroke="#0f766e"
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">IMC</p>
                <MiniTrendChart
                  values={vitalTrend.map((item) => item.imc).filter((value): value is number => value !== null)}
                  stroke="#7c3aed"
                />
              </div>
            </div>
          )}

          {vitalTrend.slice(0, showFullVitals ? 12 : 5).map((item) => (
            <div key={item.encounterId} className="rounded-card border border-surface-muted/30 p-3 text-sm">
              <div className="font-medium text-ink-primary">
                {format(new Date(item.createdAt), "d 'de' MMMM", { locale: es })}
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-ink-secondary">
                {item.presionArterial && <span>PA {item.presionArterial}</span>}
                {item.peso !== null && <span>Peso {item.peso} kg</span>}
                {item.imc !== null && <span>IMC {item.imc}</span>}
                {item.temperatura !== null && <span>T° {item.temperatura}</span>}
                {item.saturacionOxigeno !== null && <span>SatO2 {item.saturacionOxigeno}%</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Aún no hay signos vitales suficientes para mostrar tendencias.</p>
      )}

      {clinicalSummary?.latestEncounterSummary?.lines?.length ? (
        <div className="mt-4 rounded-card border border-surface-muted/30 bg-surface-base/40 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">Último resumen longitudinal</p>
          <div className="space-y-1 text-sm text-ink-secondary">
            {clinicalSummary.latestEncounterSummary.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
