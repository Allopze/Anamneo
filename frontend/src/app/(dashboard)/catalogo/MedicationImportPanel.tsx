'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiUpload } from 'react-icons/fi';
import { api, getErrorMessage } from '@/lib/api';
import { formatMedicationCatalogDefaults } from '@/lib/medication-catalog';

interface MedicationImportInvalidRow {
  rowNumber: number;
  message: string;
}

interface MedicationImportPreviewRow {
  rowNumber: number;
  name: string;
  activeIngredient: string;
  defaultDose?: string;
  defaultRoute?: string;
  defaultFrequency?: string;
  action: 'CREATE' | 'UPDATE' | 'REACTIVATE';
}

interface MedicationImportPreviewData {
  detectedFormat: 'HEADER';
  headers: string[];
  totalRows: number;
  validRows: number;
  importableRows: number;
  duplicateRows: number;
  createCount: number;
  updateCount: number;
  reactivateCount: number;
  invalidRows: MedicationImportInvalidRow[];
  preview: MedicationImportPreviewRow[];
}

const ACTION_LABELS: Record<MedicationImportPreviewRow['action'], string> = {
  CREATE: 'Nuevo',
  UPDATE: 'Actualiza',
  REACTIVATE: 'Reactiva',
};

export default function MedicationImportPanel() {
  const queryClient = useQueryClient();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<MedicationImportPreviewData | null>(null);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/medications/import/csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data as {
        created: number;
        updated: number;
        reactivated: number;
        total: number;
        duplicateRows: number;
      };
    },
    onSuccess: (data) => {
      const parts = [`${data.created} nuevos`, `${data.updated} actualizados`];
      if (data.reactivated > 0) {
        parts.push(`${data.reactivated} reactivados`);
      }
      toast.success(`Importados: ${parts.join(', ')}`);
      resetImport();
      queryClient.invalidateQueries({ queryKey: ['medications'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/medications/import/csv/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data as MedicationImportPreviewData;
    },
    onSuccess: (data, file) => {
      setImportFile(file);
      setPreviewData(data);
      if (data.invalidRows.length > 0) {
        setImportError(`Corrige ${data.invalidRows.length} fila(s) inválida(s) antes de importar`);
      }
    },
    onError: (err) => {
      resetImport();
      setImportError(getErrorMessage(err));
    },
  });

  const resetImport = () => {
    setImportFile(null);
    setImportError(null);
    setPreviewData(null);
  };

  const handleImportSelection = (file: File | null) => {
    resetImport();

    if (!file) {
      return;
    }

    const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
    if (!isCsv) {
      setImportError('El archivo debe ser CSV');
      return;
    }

    previewMutation.mutate(file);
  };

  const canImport = Boolean(
    importFile
      && previewData
      && previewData.importableRows > 0
      && previewData.invalidRows.length === 0
      && !previewMutation.isPending
      && !importMutation.isPending,
  );

  return (
    <div id="import-medications-csv" className="card space-y-4">
      <div className="panel-header flex-col items-start gap-6 lg:flex-row lg:items-center">
        <div>
          <h3 className="text-lg font-semibold text-ink-primary">Importar CSV global</h3>
          <p className="text-sm text-ink-secondary">
            Formato recomendado: <strong>nombre</strong>, <strong>principioactivo</strong>.
            También se aceptan <strong>name</strong> y <strong>activeIngredient</strong>. Opcionalmente: <strong>dosis</strong>, <strong>via</strong> y <strong>frecuencia</strong>.
          </p>
        </div>
        <button
          className="btn btn-secondary flex items-center gap-2"
          disabled={!canImport}
          onClick={() => importFile && importMutation.mutate(importFile)}
        >
          <FiUpload className="h-4 w-4" />
          {previewMutation.isPending
            ? 'Validando...'
            : importMutation.isPending
              ? 'Importando...'
              : 'Importar'}
        </button>
      </div>

      <label className="block rounded-xl border border-dashed border-surface-muted/30 bg-surface-base/40 p-5 transition-colors hover:border-status-yellow/70 hover:bg-status-yellow/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-status-yellow/60 bg-status-yellow/40">
              <FiUpload className="h-5 w-5 text-accent-text" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-primary">Selecciona un CSV</p>
              <p className="text-xs text-ink-muted">Arrastra y suelta o haz clic para elegir</p>
            </div>
          </div>
          <span className="text-xs text-ink-muted">.csv</span>
        </div>
        <input
          type="file"
          accept=".csv"
          onChange={(event) => handleImportSelection(event.target.files?.[0] ?? null)}
          className="sr-only"
        />
      </label>

      {importFile && previewData && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-secondary">
            <span className="rounded-full bg-surface-muted px-3 py-1">{importFile.name}</span>
            <span className="rounded-full bg-surface-muted px-3 py-1">{previewData.totalRows} filas</span>
            <span className="rounded-full bg-surface-muted px-3 py-1">
              {previewData.importableRows} importables
            </span>
            {previewData.duplicateRows > 0 && (
              <span className="rounded-full border border-status-yellow/70 bg-status-yellow/40 px-3 py-1 text-accent-text">
                {previewData.duplicateRows} duplicadas en el archivo
              </span>
            )}
            {previewData.invalidRows.length > 0 && (
              <span className="rounded-full border border-status-red/70 bg-status-red/10 px-3 py-1 text-status-red">
                {previewData.invalidRows.length} inválidas
              </span>
            )}
            <button className="text-ink-muted hover:text-ink-secondary" onClick={resetImport}>
              Quitar
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-ink-secondary">
            <span className="rounded-full bg-surface-muted px-3 py-1">{previewData.createCount} nuevos</span>
            <span className="rounded-full bg-surface-muted px-3 py-1">
              {previewData.updateCount} actualizaciones
            </span>
            <span className="rounded-full bg-surface-muted px-3 py-1">
              {previewData.reactivateCount} reactivaciones
            </span>
            <span className="rounded-full bg-surface-muted px-3 py-1">
              Headers: {previewData.headers.join(', ')}
            </span>
          </div>

          {previewData.preview.length > 0 && (
            <div className="rounded-xl border border-surface-muted/30 bg-surface-base/40 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-ink-primary">Vista previa</h4>
                  <p className="text-xs text-ink-muted">
                    Primeras {previewData.preview.length} filas validadas por el backend.
                  </p>
                </div>
                {previewData.importableRows > previewData.preview.length && (
                  <span className="text-xs text-ink-muted">
                    +{previewData.importableRows - previewData.preview.length} adicionales
                  </span>
                )}
              </div>
              <ul className="grid gap-3 md:grid-cols-2">
                {previewData.preview.map((row) => (
                  (() => {
                    const defaultSummary = formatMedicationCatalogDefaults(row);

                    return (
                      <li
                        key={`${row.rowNumber}-${row.name}`}
                        className="rounded-lg border border-surface-muted/30 bg-surface-elevated px-3 py-3 text-sm text-ink-secondary"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-ink-primary">{row.name}</p>
                            <p className="text-xs text-ink-muted">Fila {row.rowNumber}</p>
                          </div>
                          <span className="rounded-full border border-surface-muted/40 px-2 py-1 text-[11px] uppercase tracking-wide text-ink-secondary">
                            {ACTION_LABELS[row.action]}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-ink-muted">
                          Principio activo: {row.activeIngredient}
                        </p>
                        {defaultSummary ? (
                          <p className="mt-1 text-xs text-ink-muted">Sugerencia habitual: {defaultSummary}</p>
                        ) : null}
                      </li>
                    );
                  })()
                ))}
              </ul>
            </div>
          )}

          {previewData.invalidRows.length > 0 && (
            <div className="rounded-xl border border-status-red/40 bg-status-red/10 p-4">
              <h4 className="text-sm font-semibold text-status-red">Filas inválidas</h4>
              <ul className="mt-2 space-y-1 text-sm text-status-red">
                {previewData.invalidRows.slice(0, 5).map((row) => (
                  <li key={`${row.rowNumber}-${row.message}`}>
                    Fila {row.rowNumber}: {row.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {importError && <p className="text-sm text-status-red">{importError}</p>}
    </div>
  );
}