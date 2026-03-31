'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { canImportConditionsCsv } from '@/lib/permissions';
import { Condition } from '@/types';
import { parseJsonArray } from '@/lib/safe-json';
import { FiPlus, FiEdit2, FiSearch, FiTag, FiUpload } from 'react-icons/fi';
import { useAuthStore } from '@/stores/auth-store';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const CSV_PREVIEW_LIMIT = 6;

export default function CatalogoPage() {
  const { isAdmin, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importRows, setImportRows] = useState<number | null>(null);
  const [importPreview, setImportPreview] = useState<string[]>([]);
  const [importDuplicateRows, setImportDuplicateRows] = useState(0);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'override' | null>(null);
  const [editingCondition, setEditingCondition] = useState<Condition | null>(null);
  const [localForm, setLocalForm] = useState({ name: '', synonyms: '', tags: '' });
  const isAdminUser = isAdmin();
  const canImportCsv = canImportConditionsCsv(user);

  // Debounce search to avoid firing on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: conditions, isLoading } = useQuery({
    queryKey: ['conditions', debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      const response = await api.get(`/conditions?${params}`);
      return response.data as Condition[];
    },
  });

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
      setImportFile(null);
      setImportError(null);
      setImportRows(null);
      setImportPreview([]);
      setImportDuplicateRows(0);
      queryClient.invalidateQueries({ queryKey: ['conditions'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

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

  const saveLocalMutation = useMutation({
    mutationFn: async (payload: {
      mode: 'create' | 'edit' | 'override';
      condition?: Condition | null;
      data: { name: string; synonyms: string[]; tags: string[] };
    }) => {
      if (payload.mode === 'edit' && payload.condition) {
        return api.put(`/conditions/local/${payload.condition.id}`, payload.data);
      }
      if (payload.mode === 'override' && payload.condition) {
        return api.post('/conditions/local', {
          ...payload.data,
          baseConditionId: payload.condition.id,
        });
      }
      return api.post('/conditions/local', payload.data);
    },
    onSuccess: () => {
      toast.success('Afeccion guardada');
      setFormMode(null);
      setEditingCondition(null);
      setLocalForm({ name: '', synonyms: '', tags: '' });
      queryClient.invalidateQueries({ queryKey: ['conditions'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteLocalMutation = useMutation({
    mutationFn: async (condition: Condition) => {
      if (condition.scope === 'GLOBAL') {
        return api.delete(`/conditions/local/base/${condition.id}`);
      }
      return api.delete(`/conditions/local/${condition.id}`);
    },
    onSuccess: () => {
      toast.success('Afeccion eliminada');
      queryClient.invalidateQueries({ queryKey: ['conditions'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const openCreateForm = () => {
    setFormMode('create');
    setEditingCondition(null);
    setLocalForm({ name: '', synonyms: '', tags: '' });
  };

  const openEditForm = (condition: Condition) => {
    setEditingCondition(condition);
    setFormMode(condition.scope === 'GLOBAL' ? 'override' : 'edit');
    setLocalForm({
      name: condition.name,
      synonyms: (condition.synonyms || []).join(', '),
      tags: (condition.tags || []).join(', '),
    });
  };

  const handleSaveLocal = () => {
    if (!formMode) return;
    const data = {
      name: localForm.name.trim(),
      synonyms: localForm.synonyms
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      tags: localForm.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };
    saveLocalMutation.mutate({ mode: formMode, condition: editingCondition, data });
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Catálogo de Afecciones</h1>
          <p className="page-header-description">Base reutilizable para sugerencias y clasificación clínica.</p>
        </div>
        {isAdminUser ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/catalogo/nueva" className="btn btn-primary flex items-center gap-2">
              <FiPlus className="w-4 h-4" />
              Nueva Afección
            </Link>
            {canImportCsv && (
              <a href="#import-csv" className="btn btn-secondary flex items-center gap-2">
                <FiUpload className="w-4 h-4" />
                Importar CSV
              </a>
            )}
          </div>
        ) : (
          <button className="btn btn-primary" onClick={openCreateForm}>
            <FiPlus className="w-4 h-4 mr-2" />
            Agregar afección
          </button>
        )}
      </div>

      {canImportCsv && (
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

          <label className="mt-5 block rounded-xl border border-dashed border-surface-muted/30 bg-surface-base/40/60 p-5 transition-colors hover:border-accent/60">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                  <FiUpload className="w-5 h-5 text-accent" />
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
                  <span className="rounded-full bg-status-yellow/20 px-3 py-1 text-status-yellow">
                    {importDuplicateRows} duplicadas en el archivo
                  </span>
                )}
                <button
                  className="text-ink-muted hover:text-ink-secondary"
                  onClick={() => {
                    setImportFile(null);
                    setImportRows(null);
                    setImportError(null);
                    setImportPreview([]);
                    setImportDuplicateRows(0);
                  }}
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
      )}

      {!isAdminUser && (
        <div className="card mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-ink-primary">Mi catálogo</h2>
              <p className="text-sm text-ink-secondary">
                Agrega o personaliza afecciones solo para tu instancia
              </p>
            </div>
            <button className="btn btn-primary" onClick={openCreateForm}>
              <FiPlus className="w-4 h-4 mr-2" />
              Agregar afección
            </button>
          </div>

          {formMode && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-ink-secondary">Nombre</label>
                <input
                  className="form-input"
                  value={localForm.name}
                  onChange={(e) => setLocalForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-ink-secondary">Sinónimos (coma)</label>
                <input
                  className="form-input"
                  value={localForm.synonyms}
                  onChange={(e) => setLocalForm((p) => ({ ...p, synonyms: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-ink-secondary">Tags (coma)</label>
                <input
                  className="form-input"
                  value={localForm.tags}
                  onChange={(e) => setLocalForm((p) => ({ ...p, tags: e.target.value }))}
                />
              </div>
              <div className="md:col-span-3 flex items-center gap-2">
                <button
                  className="btn btn-primary"
                  onClick={handleSaveLocal}
                  disabled={saveLocalMutation.isPending}
                >
                  {saveLocalMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setFormMode(null);
                    setEditingCondition(null);
                    setLocalForm({ name: '', synonyms: '', tags: '' });
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="filter-surface">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar afección..."
            className="form-input pl-10"
          />
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 skeleton rounded-lg" />
            ))}
          </div>
        ) : conditions && conditions.length > 0 ? (
          <div className="divide-y divide-surface-muted/30">
            {conditions.map((condition) => (
              <div
                key={condition.id}
                className="group list-row cursor-pointer"
              >
                <div className="list-row-icon bg-status-green/20 text-status-green">
                  <FiTag className="w-5 h-5 text-status-green" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-ink-primary">{condition.name}</h3>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {(() => {
                      const synonyms = parseJsonArray(condition.synonyms);
                      return (
                        <>
                          {synonyms.slice(0, 3).map((syn: string, i: number) => (
                            <span key={i} className="list-chip bg-accent/20 text-accent">
                              {syn}
                            </span>
                          ))}
                          {synonyms.length > 3 && (
                            <span className="text-xs text-ink-muted">
                              +{synonyms.length - 3} más
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
                {isAdminUser ? (
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/catalogo/${condition.id}`}
                      className="p-2 text-ink-muted hover:text-accent hover:bg-accent/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <FiEdit2 className="w-4 h-4" />
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {condition.scope && (
                      <span className="list-chip bg-surface-muted text-ink-secondary uppercase tracking-wide text-[10px]">
                        {condition.scope === 'GLOBAL' ? 'Global' : 'Local'}
                      </span>
                    )}
                    <button
                      className="btn btn-secondary"
                      onClick={() => openEditForm(condition)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => deleteLocalMutation.mutate(condition)}
                      disabled={deleteLocalMutation.isPending}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FiTag className="w-10 h-10 text-accent" />
            </div>
            <h3 className="empty-state-title">Sin afecciones cargadas</h3>
            <p className="empty-state-description">No hay afecciones disponibles en el catálogo para esta búsqueda.</p>
          </div>
        )}
      </div>
    </div>
  );
}
