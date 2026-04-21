'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import { api, getErrorMessage } from '@/lib/api';
import { MEDICATION_ROUTE_OPTIONS } from '@/lib/medication-catalog';
import { useAuthStore } from '@/stores/auth-store';

export default function NuevoMedicamentoPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuthStore();
  const [name, setName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [defaultDose, setDefaultDose] = useState('');
  const [defaultRoute, setDefaultRoute] = useState('');
  const [defaultFrequency, setDefaultFrequency] = useState('');

  useEffect(() => {
    if (!isAdmin()) {
      router.push('/catalogo?categoria=medicamentos');
    }
  }, [isAdmin, router]);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/medications', {
        name: name.trim(),
        activeIngredient: activeIngredient.trim(),
        defaultDose: defaultDose.trim() || null,
        defaultRoute: defaultRoute || null,
        defaultFrequency: defaultFrequency.trim() || null,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Medicamento creado');
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      router.push('/catalogo?categoria=medicamentos');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (!isAdmin()) {
    return null;
  }

  return (
    <div className="max-w-2xl animate-fade-in">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/catalogo?categoria=medicamentos" className="rounded-lg p-2 hover:bg-surface-muted">
          <FiArrowLeft className="h-5 w-5 text-ink-secondary" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-ink-primary">Nuevo medicamento</h1>
          <p className="text-ink-secondary">Alta manual del catálogo global de medicamentos</p>
        </div>
      </div>

      <div className="card space-y-4">
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
            placeholder="ibuprofeno, omeprazol, ..."
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
          Estas sugerencias solo ayudan a precompletar una prescripción frecuente. La indicación real sigue guardándose por atención.
        </p>

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
      </div>
    </div>
  );
}