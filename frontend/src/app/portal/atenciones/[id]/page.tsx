'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { FiArrowLeft, FiDownload } from 'react-icons/fi';
import { portalApi, getErrorMessage } from '@/lib/portal-api';

type PortalEncounter = {
  id: string;
  fecha: string;
  status: string;
  motivoConsulta: string | null;
  tipoAtencion: string | null;
  medico?: { nombre: string } | null;
  sections: Array<{ id: string; sectionKey: string; data: unknown; completed: boolean; notApplicable: boolean }>;
  attachments: Array<{ id: string; originalName: string; mime: string; size: number; uploadedAt: string }>;
};

const SECTION_LABELS: Record<string, string> = {
  IDENTIFICACION: 'Identificación',
  MOTIVO_CONSULTA: 'Motivo de consulta',
  ANAMNESIS_PROXIMA: 'Anamnesis próxima',
  ANAMNESIS_REMOTA: 'Anamnesis remota',
  REVISION_SISTEMAS: 'Revisión por sistemas',
  EXAMEN_FISICO: 'Examen físico',
  SOSPECHA_DIAGNOSTICA: 'Sospecha diagnóstica',
  TRATAMIENTO: 'Tratamiento',
  RESPUESTA_TRATAMIENTO: 'Respuesta al tratamiento',
  OBSERVACIONES: 'Observaciones',
};

const FIELD_LABELS: Record<string, string> = {
  abdomen: 'Abdomen',
  diagnostico: 'Diagnóstico',
  edad: 'Edad',
  edadMeses: 'Edad en meses',
  id: 'ID',
  nombre: 'Nombre',
  notas: 'Notas',
  plan: 'Plan',
  prevision: 'Previsión',
  prioridad: 'Prioridad',
  rutExempt: 'RUT exento',
  rutExemptReason: 'Motivo de exención RUT',
  sexo: 'Sexo',
  sospechas: 'Sospechas',
  texto: 'Detalle',
};

const INTERNAL_FIELD_KEYS = new Set(['readonly']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function humanizeKey(key: string) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];

  const withSpaces = key
    .replaceAll('_', ' ')
    .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2')
    .toLowerCase();
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function formatScalar(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Sin registro';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return String(value);
}

function renderClinicalValue(value: unknown): ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-ink-muted">Sin registro</span>;
    return (
      <ul className="space-y-2">
        {value.map((item, index) => (
          <li key={index} className="rounded-md bg-surface-elevated px-3 py-2">
            {renderClinicalValue(item)}
          </li>
        ))}
      </ul>
    );
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).filter(
      ([key, item]) => !INTERNAL_FIELD_KEYS.has(key) && item !== undefined && item !== null && item !== '',
    );
    if (entries.length === 0) return <span className="text-ink-muted">Sin registro</span>;

    if (entries.length === 1 && entries[0]?.[0] === 'texto') {
      return <span>{formatScalar(entries[0][1])}</span>;
    }

    return (
      <dl>
        {entries.map(([key, item]) => (
          <div key={key}>
            <dt>{humanizeKey(key)}</dt>
            <dd>{renderClinicalValue(item)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return <span>{formatScalar(value)}</span>;
}

function getSectionLabel(sectionKey: string) {
  return SECTION_LABELS[sectionKey] ?? humanizeKey(sectionKey);
}

export default function PortalEncounterPage() {
  const { id } = useParams<{ id: string }>();
  const [encounter, setEncounter] = useState<PortalEncounter | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portalApi.get<PortalEncounter>(`/portal/encounters/${id}`)
      .then((res) => setEncounter(res.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, [id]);

  const handleDownloadPdf = async () => {
    try {
      const res = await portalApi.get(`/portal/encounters/${id}/export/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ficha-clinica.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <main className="portal-page">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal" className="portal-icon-button" aria-label="Volver al portal">
              <FiArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="portal-title">Ficha de atención</h1>
              <p className="portal-copy">
                {encounter ? new Date(encounter.fecha).toLocaleDateString('es-CL') : 'Cargando...'}
              </p>
            </div>
          </div>
          <button onClick={handleDownloadPdf} className="portal-button-primary">
            <FiDownload className="h-4 w-4" />
            Descargar PDF
          </button>
        </header>

        {error && <div className="portal-alert-error">{error}</div>}

        {encounter && (
          <section className="portal-card">
            <h2 className="text-lg font-semibold text-ink">
              {encounter.motivoConsulta || encounter.tipoAtencion || 'Atención clínica'}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{encounter.medico?.nombre ?? 'Equipo clínico'} · {encounter.status}</p>
            <div className="mt-5 space-y-4">
              {encounter.sections.map((section) => (
                <article key={section.id} className="portal-clinical-section">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-ink">{getSectionLabel(section.sectionKey)}</h3>
                    <span className="rounded-pill bg-surface-inset px-2.5 py-1 text-xs font-semibold text-ink-muted">
                      {section.notApplicable ? 'No aplica' : section.completed ? 'Completa' : 'Pendiente'}
                    </span>
                  </div>
                  <div className="portal-clinical-data">
                    {renderClinicalValue(section.data)}
                  </div>
                </article>
              ))}
            </div>
            {encounter.attachments.length > 0 && (
              <div className="mt-5 rounded-lg border border-surface-muted/70 p-3">
                <h3 className="text-sm font-semibold text-ink">Adjuntos asociados</h3>
                <ul className="mt-2 space-y-2 text-sm text-ink-secondary">
                  {encounter.attachments.map((attachment) => (
                    <li key={attachment.id} className="flex justify-between gap-3">
                      <span>{attachment.originalName}</span>
                      <span className="text-xs text-ink-muted">{attachment.mime}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
