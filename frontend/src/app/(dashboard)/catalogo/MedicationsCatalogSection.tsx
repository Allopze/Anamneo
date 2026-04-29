'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiEdit2, FiPackage, FiPlus, FiSearch, FiUpload } from 'react-icons/fi';
import { api, getErrorMessage } from '@/lib/api';
import { formatMedicationCatalogDefaults } from '@/lib/medication-catalog';
import { canImportMedicationsCsv } from '@/lib/permissions';
import { useAuthIsAdmin, useAuthUser } from '@/stores/auth-store';
import { MedicationCatalogItem } from '@/types';
import MedicationImportPanel from './MedicationImportPanel';

export default function MedicationsCatalogSection() {
  const user = useAuthUser();
  const isAdminUser = useAuthIsAdmin();
  const queryClient = useQueryClient();
  const canImportCsv = canImportMedicationsCsv(user);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: medications, isLoading } = useQuery({
    queryKey: ['medications', debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }
      const response = await api.get(`/medications?${params}`);
      return response.data as MedicationCatalogItem[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (medicationId: string) => api.delete(`/medications/${medicationId}`),
    onSuccess: () => {
      toast.success('Medicamento eliminado');
      queryClient.invalidateQueries({ queryKey: ['medications'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink-primary">Medicamentos</h2>
          <p className="text-sm text-ink-secondary">
            Catálogo global para normalizar nombre visible y principio activo en futuras cargas y ayudas de registro.
          </p>
        </div>
        {isAdminUser && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/catalogo/medicamentos/nueva"
              className="btn btn-primary flex items-center gap-2"
            >
              <FiPlus className="h-4 w-4" />
              Nuevo medicamento
            </Link>
            {canImportCsv && (
              <a
                href="#import-medications-csv"
                className="btn btn-secondary flex items-center gap-2"
              >
                <FiUpload className="h-4 w-4" />
                Importar CSV
              </a>
            )}
          </div>
        )}
      </div>

      {canImportCsv && <MedicationImportPanel />}

      <div className="filter-surface">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o principio activo..."
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
        ) : medications && medications.length > 0 ? (
          <div className="divide-y divide-surface-muted/30">
            {medications.map((medication) => (
              (() => {
                const defaultSummary = formatMedicationCatalogDefaults(medication);

                return (
                  <div key={medication.id} className="group list-row cursor-pointer">
                    <div className="list-row-icon bg-sky-100 text-sky-700">
                      <FiPackage className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-ink-primary">{medication.name}</h3>
                        {!medication.active && (
                          <span className="list-chip border border-status-red/40 bg-status-red/10 text-status-red">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-ink-secondary">
                        Principio activo: {medication.activeIngredient}
                      </p>
                      {defaultSummary ? (
                        <p className="mt-1 text-xs text-ink-muted">Sugerencia habitual: {defaultSummary}</p>
                      ) : null}
                    </div>
                    {isAdminUser && (
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/catalogo/medicamentos/${medication.id}`}
                          className="rounded-lg p-2 text-ink-muted opacity-0 transition-[background-color,color,opacity] hover:bg-accent/10 hover:text-accent group-hover:opacity-100"
                        >
                          <FiEdit2 className="h-4 w-4" />
                        </Link>
                        <button
                          className="btn btn-danger"
                          onClick={() => deleteMutation.mutate(medication.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FiPackage className="h-10 w-10 text-accent" />
            </div>
            <h3 className="empty-state-title">Sin medicamentos cargados</h3>
            <p className="empty-state-description">
              No hay medicamentos disponibles para esta búsqueda.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
