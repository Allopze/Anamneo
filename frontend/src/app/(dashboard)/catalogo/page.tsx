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
import CatalogImportPanel from './CatalogImportPanel';

export default function CatalogoPage() {
  const { isAdmin, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
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
          <h1 className="page-header-title">Catálogo</h1>
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

      {canImportCsv && <CatalogImportPanel />}

      {!isAdminUser && (
        <div className="card mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-ink-primary">Mi catálogo</h2>
              <p className="text-sm text-ink-secondary">
                Agrega o personaliza afecciones solo para tu instancia
              </p>
            </div>
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
                            <span
                              key={i}
                              className="list-chip border border-status-yellow/65 bg-status-yellow/35 text-accent-text"
                            >
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
