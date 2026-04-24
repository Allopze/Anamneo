'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { invalidateDashboardOverviewQueries } from '@/lib/query-invalidation';
import { useAuthStore } from '@/stores/auth-store';
import { Patient } from '@/types';
import { InProgressEncounterConflictModal, InProgressEncounterSummary } from '@/components/common/InProgressEncounterConflictModal';
import { FiArrowLeft, FiSearch, FiUser, FiPlus } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { formatPatientAge, getPatientCompletenessMeta } from '@/lib/patient';

export default function NuevaAtencionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, canCreateEncounter, isMedico } = useAuthStore();
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim();
  const hasSearchTerm = normalizedSearch.length >= 2;
  const canCreate = canCreateEncounter();

  useEffect(() => {
    if (!user) return;
    if (canCreate) return;
    toast.error('No tiene permisos para crear atenciones');
    router.push('/pacientes');
  }, [user, canCreate, router]);
  const [conflictEncounters, setConflictEncounters] = useState<InProgressEncounterSummary[] | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Pick<Patient, 'id' | 'nombre' | 'rut'> | null>(null);

  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients-search', normalizedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', '12');
      params.set('sortBy', 'updatedAt');
      params.set('sortOrder', 'desc');
      if (normalizedSearch.length >= 2) {
        params.set('search', normalizedSearch);
      }
      const response = await api.get(`/patients?${params.toString()}`);
      return response.data.data as Patient[];
    },
    enabled: canCreate,
  });

  const createMutation = useMutation({
    mutationFn: (patientId: string) => api.post(`/encounters/patient/${patientId}`, {}),
    onSuccess: async (response) => {
      const reused = Boolean((response.data as any)?.reused);
      await invalidateDashboardOverviewQueries(queryClient);
      toast.success(reused ? 'Ya había una atención en curso. Abriendo…' : 'Atención creada');
      router.push(`/atenciones/${response.data.id}`);
    },
    onError: (err) => {
      const anyErr = err as any;
      const status = anyErr?.response?.status;
      const data = anyErr?.response?.data;

      if (status === 409 && Array.isArray(data?.inProgressEncounters)) {
        setConflictEncounters(data.inProgressEncounters as InProgressEncounterSummary[]);
        return;
      }

      toast.error(getErrorMessage(err));
    },
  });

  if (!canCreate) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-5xl animate-fade-in">
      {conflictEncounters && (
        <InProgressEncounterConflictModal
          encounters={conflictEncounters}
          patient={selectedPatient ? { nombre: selectedPatient.nombre, rut: selectedPatient.rut } : null}
          onClose={() => setConflictEncounters(null)}
          onOpenEncounter={(encounterId) => {
            setConflictEncounters(null);
            router.push(`/atenciones/${encounterId}`);
          }}
          allowCancel={isMedico()}
          onCancelled={(encounterId) => {
            setConflictEncounters((prev) => {
              if (!prev) return prev;
              const next = prev.filter((e) => e.id !== encounterId);
              return next.length > 0 ? next : null;
            });
          }}
        />
      )}

      <div className="flex items-center gap-4 mb-6">
        <Link href="/atenciones" className="p-2 hover:bg-surface-muted rounded-card transition-colors">
          <FiArrowLeft className="w-5 h-5 text-ink-secondary" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-ink-primary">Nueva Atención</h1>
          <p className="text-ink-secondary">Selecciona un paciente para iniciar</p>
        </div>
      </div>

      <div className="card">
        <div className="relative mb-4">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar paciente por nombre o RUT..."
            className="form-input pl-10"
          />
        </div>

        <div className="mb-3 text-sm text-ink-secondary">
          {hasSearchTerm
            ? 'Resultados filtrados por nombre o RUT.'
            : 'Mostrando pacientes recientes. Escribe 2 caracteres o más para filtrar.'}
        </div>

        <div className="border border-surface-muted/30 rounded-card divide-y divide-surface-muted/30">
          {isLoading ? (
            <div className="p-4 text-center text-ink-muted">Cargando pacientes...</div>
          ) : patients && patients.length > 0 ? (
            patients.map((patient) => (
              (() => {
                const completenessMeta = getPatientCompletenessMeta(patient);

                return (
                  <button
                    key={patient.id}
                    onClick={() => {
                      setSelectedPatient({ id: patient.id, nombre: patient.nombre, rut: patient.rut });
                      createMutation.mutate(patient.id);
                    }}
                    disabled={createMutation.isPending}
                    className="w-full flex items-center gap-4 p-4 hover:bg-surface-muted/50 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full border border-status-yellow/60 bg-status-yellow/35 flex items-center justify-center">
                      <FiUser className="w-5 h-5 text-ink-secondary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-ink-primary">{patient.nombre}</p>
                        <span className={`list-chip ${completenessMeta.badgeClassName}`}>{completenessMeta.label}</span>
                      </div>
                      <p className="text-sm text-ink-muted">
                        {patient.rut || 'Sin RUT'} • {formatPatientAge(patient.edad, patient.edadMeses)}
                      </p>
                    </div>
                    <FiPlus className="w-5 h-5 text-accent-text" />
                  </button>
                );
              })()
            ))
          ) : (
            <div className="p-8 text-center">
              <p className="text-ink-muted mb-4">
                {hasSearchTerm ? 'No se encontraron pacientes para esta búsqueda' : 'Aún no hay pacientes registrados'}
              </p>
              <Link href="/pacientes/nuevo" className="btn btn-primary">
                Crear nuevo paciente
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
