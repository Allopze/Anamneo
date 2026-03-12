'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Condition } from '@/types';
import { parseJsonArray } from '@/lib/safe-json';
import { FiPlus, FiEdit2, FiSearch, FiTag, FiUpload } from 'react-icons/fi';
import { useAuthStore } from '@/stores/auth-store';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function CatalogoPage() {
  const { isAdmin } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importRows, setImportRows] = useState<number | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'override' | null>(null);
  const [editingCondition, setEditingCondition] = useState<Condition | null>(null);
  const [localForm, setLocalForm] = useState({ name: '', synonyms: '', tags: '' });
  const isAdminUser = isAdmin();

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
      queryClient.invalidateQueries({ queryKey: ['conditions'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleImportSelection = async (file: File | null) => {
    setImportError(null);
    setImportRows(null);

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

      setImportRows(contentLines.length);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Catálogo de Afecciones</h1>
          <p className="text-slate-600">Afecciones para sugerencias automáticas</p>
        </div>
        {isAdminUser ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/catalogo/nueva" className="btn btn-primary flex items-center gap-2">
              <FiPlus className="w-4 h-4" />
              Nueva Afección
            </Link>
            <a href="#import-csv" className="btn btn-secondary flex items-center gap-2">
              <FiUpload className="w-4 h-4" />
              Importar CSV
            </a>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={openCreateForm}>
            <FiPlus className="w-4 h-4 mr-2" />
            Agregar afección
          </button>
        )}
      </div>

      {isAdminUser && (
        <div id="import-csv" className="card mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Importar CSV global</h2>
              <p className="text-sm text-slate-600">
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

          <label className="mt-5 block rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-5 transition-colors hover:border-primary-300">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                  <FiUpload className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Selecciona un CSV</p>
                  <p className="text-xs text-slate-500">Arrastra y suelta o haz clic para elegir</p>
                </div>
              </div>
              <span className="text-xs text-slate-500">.csv</span>
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleImportSelection(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>

          {importFile && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className="rounded-full bg-slate-100 px-3 py-1">{importFile.name}</span>
              {typeof importRows === 'number' && (
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  {importRows} filas
                </span>
              )}
              <button
                className="text-slate-500 hover:text-slate-700"
                onClick={() => {
                  setImportFile(null);
                  setImportRows(null);
                  setImportError(null);
                }}
              >
                Quitar
              </button>
            </div>
          )}

          {importError && (
            <p className="mt-3 text-sm text-red-600">{importError}</p>
          )}
        </div>
      )}

      {!isAdminUser && (
        <div className="card mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Mi catálogo</h2>
              <p className="text-sm text-slate-600">
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
                <label className="text-sm text-slate-600">Nombre</label>
                <input
                  className="form-input"
                  value={localForm.name}
                  onChange={(e) => setLocalForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-slate-600">Sinónimos (coma)</label>
                <input
                  className="form-input"
                  value={localForm.synonyms}
                  onChange={(e) => setLocalForm((p) => ({ ...p, synonyms: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-slate-600">Tags (coma)</label>
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

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar afección..."
            className="form-input pl-10"
          />
        </div>
      </div>

      {/* List */}
      <div className="card">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 skeleton rounded-lg" />
            ))}
          </div>
        ) : conditions && conditions.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {conditions.map((condition) => (
              <div
                key={condition.id}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors group cursor-pointer"
              >
                <div className="w-10 h-10 bg-clinical-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <FiTag className="w-5 h-5 text-clinical-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-slate-900">{condition.name}</h3>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {(() => {
                      const synonyms = parseJsonArray(condition.synonyms);
                      return (
                        <>
                          {synonyms.slice(0, 3).map((syn: string, i: number) => (
                            <span key={i} className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                              {syn}
                            </span>
                          ))}
                          {synonyms.length > 3 && (
                            <span className="text-xs text-slate-500">
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
                      className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <FiEdit2 className="w-4 h-4" />
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {condition.scope && (
                      <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
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
          <div className="p-12 text-center">
            <FiTag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No hay afecciones en el catálogo</p>
          </div>
        )}
      </div>
    </div>
  );
}
