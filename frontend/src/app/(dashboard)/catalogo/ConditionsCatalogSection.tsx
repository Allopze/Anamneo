'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiEdit2, FiPlus, FiSearch, FiTag, FiUpload } from 'react-icons/fi';
import { api, getErrorMessage } from '@/lib/api';
import { canImportConditionsCsv } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth-store';
import { Condition } from '@/types';
import CatalogImportPanel from './CatalogImportPanel';

export default function ConditionsCatalogSection() {
  const { isAdmin, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'override' | null>(null);
  const [editingCondition, setEditingCondition] = useState<Condition | null>(null);
  const [localForm, setLocalForm] = useState({ name: '', synonyms: '', tags: '' });
  const isAdminUser = isAdmin();
  const canImportCsv = canImportConditionsCsv(user);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: conditions, isLoading } = useQuery({
    queryKey: ['conditions', debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }
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
      toast.success('Afección guardada');
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
      toast.success('Afección eliminada');
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
    if (!formMode) {
      return;
    }

    saveLocalMutation.mutate({
      mode: formMode,
      condition: editingCondition,
      data: {
        name: localForm.name.trim(),
        synonyms: localForm.synonyms
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        tags: localForm.tags
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink-primary">Afecciones</h2>
          <p className="text-sm text-ink-secondary">
            Base reutilizable para sugerencias diagnósticas y clasificación clínica.
          </p>
        </div>
        {isAdminUser ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/catalogo/nueva" className="btn btn-primary flex items-center gap-2">
              <FiPlus className="w-4 h-4" />
              Nueva afección
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
            <FiPlus className="mr-2 h-4 w-4" />
            Agregar afección
          </button>
        )}
      </div>

      {canImportCsv && <CatalogImportPanel />}

      {!isAdminUser && (
        <div className="card space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-ink-primary">Mi catálogo</h3>
            <p className="text-sm text-ink-secondary">
              Agrega o personaliza afecciones solo para tu instancia.
            </p>
          </div>

          {formMode && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm text-ink-secondary">Nombre</label>
                <input
                  className="form-input"
                  value={localForm.name}
                  onChange={(event) => setLocalForm((previous) => ({ ...previous, name: event.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-ink-secondary">Sinónimos (coma)</label>
                <input
                  className="form-input"
                  value={localForm.synonyms}
                  onChange={(event) => setLocalForm((previous) => ({ ...previous, synonyms: event.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-ink-secondary">Tags (coma)</label>
                <input
                  className="form-input"
                  value={localForm.tags}
                  onChange={(event) => setLocalForm((previous) => ({ ...previous, tags: event.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2 md:col-span-3">
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
          <FiSearch className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar afección..."
            className="form-input pl-10"
          />
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(8)].map((_, index) => (
              <div key={index} className="h-16 rounded-lg skeleton" />
            ))}
          </div>
        ) : conditions && conditions.length > 0 ? (
          <div className="divide-y divide-surface-muted/30">
            {conditions.map((condition) => (
              <div key={condition.id} className="group list-row cursor-pointer">
                <div className="list-row-icon bg-status-green/20 text-status-green">
                  <FiTag className="h-5 w-5 text-status-green" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-ink-primary">{condition.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {condition.synonyms.slice(0, 3).map((synonym, index) => (
                      <span
                        key={`${condition.id}-syn-${index}`}
                        className="list-chip border border-status-yellow/65 bg-status-yellow/35 text-accent-text"
                      >
                        {synonym}
                      </span>
                    ))}
                    {condition.synonyms.length > 3 && (
                      <span className="text-xs text-ink-muted">+{condition.synonyms.length - 3} más</span>
                    )}
                  </div>
                </div>
                {isAdminUser ? (
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/catalogo/${condition.id}`}
                      className="rounded-lg p-2 text-ink-muted opacity-0 transition-all hover:bg-accent/10 hover:text-accent group-hover:opacity-100"
                    >
                      <FiEdit2 className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {condition.scope && (
                      <span className="list-chip bg-surface-muted text-[10px] uppercase tracking-wide text-ink-secondary">
                        {condition.scope === 'GLOBAL' ? 'Global' : 'Local'}
                      </span>
                    )}
                    <button className="btn btn-secondary" onClick={() => openEditForm(condition)}>
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
              <FiTag className="h-10 w-10 text-accent" />
            </div>
            <h3 className="empty-state-title">Sin afecciones cargadas</h3>
            <p className="empty-state-description">
              No hay afecciones disponibles en el catálogo para esta búsqueda.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}