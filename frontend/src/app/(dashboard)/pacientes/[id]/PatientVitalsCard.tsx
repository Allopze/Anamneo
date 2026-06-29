import { useState } from 'react';
import { FiActivity } from 'react-icons/fi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';
import MiniTrendChart from '@/components/common/MiniTrendChart';
import type { PatientClinicalSummary } from '@/types';
import { VITAL_CHART_CONFIG, type VitalKey } from './patient-detail.constants';
import type { PatientDetailHook } from './usePatientDetail';
import { assessVitalSigns } from '../../../../../../shared/vital-sign-alerts';
type VitalTrendItem = PatientClinicalSummary['vitalTrend'][number];
type Props = Pick<
  PatientDetailHook,
  'vitalTrend' | 'showFullVitals' | 'setShowFullVitals' | 'selectedVitalKey' | 'setSelectedVitalKey'
> & {
  clinicalSummary: PatientClinicalSummary | undefined;
};
type ViewMode = 'chart' | 'table';
function vitalToStrings(item: VitalTrendItem): Record<string, string | undefined> {
  return {
    presionArterial: item.presionArterial ?? undefined,
    frecuenciaCardiaca: item.frecuenciaCardiaca !== null ? String(item.frecuenciaCardiaca) : undefined,
    frecuenciaRespiratoria: item.frecuenciaRespiratoria !== null ? String(item.frecuenciaRespiratoria) : undefined,
    temperatura: item.temperatura !== null ? String(item.temperatura) : undefined,
    saturacionOxigeno: item.saturacionOxigeno !== null ? String(item.saturacionOxigeno) : undefined,
  };
}
const VITAL_COLUMNS: Array<{ key: keyof VitalTrendItem | 'presionArterial'; label: string; unit: string }> = [
  { key: 'presionArterial', label: 'PA', unit: 'mmHg' },
  { key: 'frecuenciaCardiaca', label: 'FC', unit: 'lpm' },
  { key: 'frecuenciaRespiratoria', label: 'FR', unit: 'rpm' },
  { key: 'temperatura', label: 'T°', unit: '°C' },
  { key: 'saturacionOxigeno', label: 'SatO₂', unit: '%' },
  { key: 'peso', label: 'Peso', unit: 'kg' },
  { key: 'imc', label: 'IMC', unit: '' },
];
function VitalCell({ value, field }: { value: string | number | null; field: string }) {
  if (value === null || value === undefined) {
    return <span className="text-ink-muted">—</span>;
  }
  const strVal = String(value);
  const assessments = assessVitalSigns({ [field]: strVal });
  const assessment = assessments[field as keyof typeof assessments];
  const cellClass = assessment
    ? assessment.severity === 'critical'
      ? 'bg-status-red/12 text-status-red-text font-semibold rounded px-1'
      : 'bg-status-yellow/12 text-accent-text rounded px-1'
    : '';
  return (
    <span className={cellClass} title={assessment?.summary}>
      {strVal}
    </span>
  );
}
export default function PatientVitalsCard({
  clinicalSummary,
  vitalTrend,
  showFullVitals,
  setShowFullVitals,
  selectedVitalKey,
  setSelectedVitalKey,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const strokeColor = VITAL_CHART_CONFIG.find((c) => c.key === selectedVitalKey)?.stroke ?? '#0f766e';
  const chartLabel: Record<VitalKey, string> = {
    peso: 'Peso (kg)',
    imc: 'IMC',
    temperatura: 'Temperatura (°C)',
    saturacionOxigeno: 'Saturación O₂ (%)',
    frecuenciaCardiaca: 'Frec. cardíaca (lpm)',
    frecuenciaRespiratoria: 'Frec. respiratoria (rpm)',
  };
  const displayedItems = vitalTrend.slice(0, showFullVitals ? 24 : 6);
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FiActivity className="w-5 h-5 text-accent-text" />
          <h2 className="text-lg font-bold text-ink">Tendencias clínicas</h2>
        </div>
        {vitalTrend.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-surface-muted/50 bg-surface-base text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('chart')}
                className={clsx(
                  'px-3 py-1.5 transition-colors',
                  viewMode === 'chart' ? 'bg-frame text-white' : 'text-ink-secondary hover:text-ink',
                )}
              >
                Gráfico
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={clsx(
                  'px-3 py-1.5 transition-colors',
                  viewMode === 'table' ? 'bg-frame text-white' : 'text-ink-secondary hover:text-ink',
                )}
              >
                Tabla
              </button>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-accent-text hover:text-ink transition-colors"
              onClick={() => setShowFullVitals((prev: boolean) => !prev)}
            >
              {showFullVitals ? 'Ver resumen' : 'Ver historial completo'}
            </button>
          </div>
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
        <>
          {viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-muted/40">
                    <th className="pb-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted whitespace-nowrap">
                      Fecha
                    </th>
                    {VITAL_COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className="pb-2 px-2 text-center text-xs font-semibold uppercase tracking-wide text-ink-muted whitespace-nowrap"
                      >
                        {col.label}
                        {col.unit && <span className="ml-0.5 font-normal normal-case text-ink-muted/60">({col.unit})</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-muted/25">
                  {displayedItems.map((item) => {
                    const vitalsStr = vitalToStrings(item);
                    return (
                      <tr key={item.encounterId} className="hover:bg-surface-inset/30 transition-colors">
                        <td className="py-2 pr-3 text-xs font-medium text-ink-secondary whitespace-nowrap">
                          {format(new Date(item.createdAt), "d MMM yy", { locale: es })}
                        </td>
                        <td className="py-2 px-2 text-center text-xs">
                          <VitalCell value={item.presionArterial} field="presionArterial" />
                        </td>
                        <td className="py-2 px-2 text-center text-xs">
                          <VitalCell value={item.frecuenciaCardiaca} field="frecuenciaCardiaca" />
                        </td>
                        <td className="py-2 px-2 text-center text-xs">
                          <VitalCell value={item.frecuenciaRespiratoria} field="frecuenciaRespiratoria" />
                        </td>
                        <td className="py-2 px-2 text-center text-xs">
                          <VitalCell value={item.temperatura} field="temperatura" />
                        </td>
                        <td className="py-2 px-2 text-center text-xs">
                          <VitalCell value={item.saturacionOxigeno} field="saturacionOxigeno" />
                        </td>
                        <td className="py-2 px-2 text-center text-xs text-ink-secondary">
                          {item.peso !== null ? item.peso : <span className="text-ink-muted">—</span>}
                        </td>
                        <td className="py-2 px-2 text-center text-xs text-ink-secondary">
                          {item.imc !== null ? item.imc : <span className="text-ink-muted">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!showFullVitals && vitalTrend.length > 6 && (
                <p className="mt-2 text-center text-xs text-ink-muted">
                  Mostrando 6 de {vitalTrend.length} registros.{' '}
                  <button
                    type="button"
                    className="font-medium text-accent-text hover:text-ink"
                    onClick={() => setShowFullVitals(true)}
                  >
                    Ver todos
                  </button>
                </p>
              )}
            </div>
          ) : (
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
                  <p className="mb-1 text-xs font-medium text-ink-muted">
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
                    <p className="mb-1 text-xs font-medium text-ink-muted">Peso</p>
                    <MiniTrendChart
                      values={vitalTrend.map((item) => item.peso).filter((value): value is number => value !== null)}
                      stroke="#0f766e"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-ink-muted">IMC</p>
                    <MiniTrendChart
                      values={vitalTrend.map((item) => item.imc).filter((value): value is number => value !== null)}
                      stroke="#7c3aed"
                    />
                  </div>
                </div>
              )}
              {displayedItems.map((item) => (
                <div key={item.encounterId} className="rounded-card border border-surface-muted/30 p-3 text-sm">
                  <div className="font-medium text-ink-primary">
                    {format(new Date(item.createdAt), "d 'de' MMMM", { locale: es })}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-ink-secondary">
                    {item.presionArterial && <span>PA {item.presionArterial}</span>}
                    {item.peso !== null && <span>Peso {item.peso} kg</span>}
                    {item.imc !== null && <span>IMC {item.imc}</span>}
                    {item.temperatura !== null && <span>T° {item.temperatura}</span>}
                    {item.saturacionOxigeno !== null && <span>SatO₂ {item.saturacionOxigeno}%</span>}
                    {item.frecuenciaCardiaca !== null && <span>FC {item.frecuenciaCardiaca} lpm</span>}
                    {item.frecuenciaRespiratoria !== null && <span>FR {item.frecuenciaRespiratoria} rpm</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center gap-2 py-3 text-sm text-ink-muted">
          <FiActivity className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Aún no hay signos vitales suficientes para mostrar tendencias.</span>
        </div>
      )}
      {clinicalSummary?.latestEncounterSummary?.lines?.length ? (
        <div className="mt-4 rounded-card border border-surface-muted/30 bg-surface-base/40 p-3">
          <p className="mb-2 text-xs font-medium text-ink-muted">Último resumen longitudinal</p>
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
