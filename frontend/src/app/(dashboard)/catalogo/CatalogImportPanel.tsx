'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { FiUpload } from 'react-icons/fi';
import toast from 'react-hot-toast';

const CSV_PREVIEW_LIMIT = 6;

export default function CatalogImportPanel() {
  const queryClient = useQueryClient();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importRows, setImportRows] = useState<number | null>(null);
  const [importPreview, setImportPreview] = useState<string[]>([]);
  const [importDuplicateRows, setImportDuplicateRows] = useState(0);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/conditions/import/csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data as { created: number; updated: number; total: number };
    },
    onSuccess: (data) => {
      toast.success(`Importadas: ${data.created} nuevas, ${data.updated} actualizadas`);
      resetImport();
      queryClient.invalidateQueries({ queryKey: ['conditions'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const resetImport = () => {
    setImportFile(null);
    setImportError(null);
    setImportRows(null);
    setImportPreview([]);
    setImportDuplicateRows(0);
  };

  const handleImportSelection = async (file: File | null) => {
    setImportError(null);
    setImportRows(null);
    setImportPreview([]);
    setImportDuplicateRows(0);

    if (!file) {
      setImportFile(null);
      return;
    }

    const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
    if (!isCsv) {
      setImportFile(null);
      setImportError('El archivo debe ser CSV');
      return;
    }

    try {
      const text = await file.text();
      const lines = text
        .replace(/\uFEFF/g, '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const contentLines =
        lines[0]?.toLowerCase() === 'name' ? lines.slice(1) : lines;

      const normalizedRows = contentLines
        .map((line) => line.split(',')[0]?.trim() || '')
        .filter(Boolean);

      if (normalizedRows.length === 0) {
        setImportFile(null);
        setImportError('El CSV no contiene filas válidas para importar');
        return;
      }

      const seen = new Set<string>();
      let duplicateCount = 0;
      normalizedRows.forEach((row) => {
        const normalizedKey = row.toLowerCase();
        if (seen.has(normalizedKey)) {
          duplicateCount += 1;
          return;
        }
        seen.add(normalizedKey);
      });

      setImportRows(normalizedRows.length);
      setImportPreview(normalizedRows.slice(0, CSV_PREVIEW_LIMIT));
      setImportDuplicateRows(duplicateCount);
      setImportFile(file);
    } catch {
      setImportFile(null);
      setImportError('No se pudo leer el archivo');
    }
  };

  return (
    <div id="import-csv" className="card mb-6">
      <div className="panel-header flex-col items-start gap-6 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-lg font-semibold text-ink-primary">Importar CSV global</h2>
          <p className="text-sm text-ink-secondary">
            Carga masiva inicial del catálogo. Formato: una columna llamada <strong>name</strong>.
          </p>
        </div>
        <button
          className="btn btn-secondary flex items-center gap-2"
          disabled={!importFile || importMutation.isPending || importRows === 0}
          onClick={() => importFile && importMutation.mutate(importFile)}
        >
          <FiUpload className="w-4 h-4" />
          {importMutation.isPending ? 'Importando...' : 'Importar'}
        </button>
      </div>

      <label className="mt-5 block rounded-xl border border-dashed border-surface-muted/30 bg-surface-base/40/60 p-5 transition-colors hover:border-status-yellow/70 hover:bg-status-yellow/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-status-yellow/60 bg-status-yellow/40">
              <FiUpload className="w-5 h-5 text-accent-text" />
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
          onChange={(e) => handleImportSelection(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
      </label>

      {importFile && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-secondary">
            <span className="rounded-full bg-surface-muted px-3 py-1">{importFile.name}</span>
            {typeof importRows === 'number' && (
              <span className="rounded-full bg-surface-muted px-3 py-1">
                {importRows} filas
              </span>
            )}
            {importDuplicateRows > 0 && (
              <span className="rounded-full border border-status-yellow/70 bg-status-yellow/40 px-3 py-1 text-accent-text">
                {importDuplicateRows} duplicadas en el archivo
              </span>
            )}
            <button
              className="text-ink-muted hover:text-ink-secondary"
              onClick={resetImport}
            >
              Quitar
            </button>
          </div>

          {importPreview.length > 0 && (
            <div className="rounded-xl border border-surface-muted/30 bg-surface-base/40 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink-primary">Vista previa</h3>
                  <p className="text-xs text-ink-muted">
                    Primeras {importPreview.length} filas que se intentarán importar.
                  </p>
                </div>
                {typeof importRows === 'number' && importRows > importPreview.length && (
                  <span className="text-xs text-ink-muted">
                    +{importRows - importPreview.length} adicionales
                  </span>
                )}
              </div>
              <ul className="grid gap-2 md:grid-cols-2">
                {importPreview.map((row, index) => (
                  <li
                    key={`${row}-${index}`}
                    className="rounded-lg border border-surface-muted/30 bg-surface-elevated px-3 py-2 text-sm text-ink-secondary"
                  >
                    {row}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {importError && (
        <p className="mt-3 text-sm text-status-red">{importError}</p>
      )}
    </div>
  );
}
