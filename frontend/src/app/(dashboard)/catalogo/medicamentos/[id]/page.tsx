'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import { api, getErrorMessage } from '@/lib/api';
import { MEDICATION_ROUTE_OPTIONS } from '@/lib/medication-catalog';
import { useAuthIsAdmin } from '@/stores/auth-store';
import { MedicationCatalogItem } from '@/types';

export default function EditarMedicamentoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAdmin = useAuthIsAdmin();
  const [name, setName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [defaultDose, setDefaultDose] = useState('');
  const [defaultRoute, setDefaultRoute] = useState('');
  const [defaultFrequency, setDefaultFrequency] = useState('');
  const [active, setActive] = useState(true);

  const { data: medication, isLoading } = useQuery({
    queryKey: ['medication', id],
    queryFn: async () => {
      const response = await api.get(`/medications/${id}`);
      return response.data as MedicationCatalogItem;
    },
    enabled: isAdmin,
  });

  useEffect(() => {
    if (!isAdmin) {
      router.push('/catalogo?categoria=medicamentos');
      return;
    }

    if (medication) {
      setName(medication.name);
      setActiveIngredient(medication.activeIngredient);
      setDefaultDose(medication.defaultDose ?? '');
      setDefaultRoute(medication.defaultRoute ?? '');
      setDefaultFrequency(medication.defaultFrequency ?? '');
      setActive(medication.active);
    }
  }, [isAdmin, medication, router]);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await api.put(`/medications/${id}`, {
        name: name.trim(),
        activeIngredient: activeIngredient.trim(),
        defaultDose: defaultDose.trim() || null,
        defaultRoute: defaultRoute || null,
        defaultFrequency: defaultFrequency.trim() || null,
        active,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Medicamento actualizado');
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      queryClient.invalidateQueries({ queryKey: ['medication', id] });
      router.push('/catalogo?categoria=medicamentos');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="max-w-2xl animate-fade-in">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/catalogo?categoria=medicamentos" className="rounded-lg p-2 hover:bg-surface-muted">
          <FiArrowLeft className="h-5 w-5 text-ink-secondary" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-ink-primary">Editar medicamento</h1>
          <p className="text-ink-secondary">Actualiza nombre, principio activo y estado</p>
        </div>
      </div>

      <div className="card space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-10 rounded skeleton" />
            <div className="h-10 rounded skeleton" />
          </div>
        ) : (
          <>
            <div>
              <label className="text-sm text-ink-secondary">Nombre</label>
              <input className="form-input" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div>
              <label className="text-sm text-ink-secondary">Principio activo</label>
              <input
                className="form-input"
                value={activeIngredient}
                onChange={(event) => setActiveIngredient(event.target.value)}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm text-ink-secondary">Dosis sugerida</label>
                <input
                  className="form-input"
                  value={defaultDose}
                  onChange={(event) => setDefaultDose(event.target.value)}
                  placeholder="Ej: 500 mg"
                />
              </div>
              <div>
                <label className="text-sm text-ink-secondary">Vía sugerida</label>
                <select
                  className="form-input"
                  value={defaultRoute}
                  onChange={(event) => setDefaultRoute(event.target.value)}
                >
                  <option value="">Sin sugerencia</option>
                  {MEDICATION_ROUTE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-ink-secondary">Frecuencia sugerida</label>
                <input
                  className="form-input"
                  value={defaultFrequency}
                  onChange={(event) => setDefaultFrequency(event.target.value)}
                  placeholder="Ej: cada 8 h"
                />
              </div>
            </div>
            <p className="text-xs text-ink-muted">
              Estas sugerencias se usan solo para precompletar campos vacíos al seleccionar el medicamento en una atención.
            </p>
            <div>
              <label className="inline-flex items-center gap-2 text-sm text-ink-secondary">
                <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
                Activo
              </label>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="btn btn-primary flex items-center gap-2"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
              >
                <FiSave className="h-4 w-4" />
                Guardar
              </button>
              <Link href="/catalogo?categoria=medicamentos" className="btn btn-secondary">
                Cancelar
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
