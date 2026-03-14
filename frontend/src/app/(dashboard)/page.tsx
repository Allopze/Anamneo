'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { STATUS_LABELS } from '@/types';
import {
  FiFileText, FiUsers, FiActivity, FiCheckCircle,
  FiXCircle, FiClock, FiPlus, FiChevronRight,
} from 'react-icons/fi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';
import { getFirstName } from '@/lib/utils';

interface DashboardData {
  counts: { enProgreso: number; completado: number; cancelado: number; total: number };
  recent: Array<{
    id: string;
    patientId: string;
    patientName: string;
    patientRut: string | null;
    createdByName: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    progress: { completed: number; total: number };
  }>;
}

export default function DashboardPage() {
  const { user, canCreateEncounter, canCreatePatient } = useAuthStore();
  const canNewEncounter = canCreateEncounter();
  const canNewPatient = canCreatePatient();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get('/encounters/stats/dashboard');
      return res.data;
    },
  });

  return (
    <div className="animate-fade-in">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          ¡Hola, {getFirstName(user?.nombre)}!
        </h1>
        <p className="text-slate-600 mt-1">Resumen de actividad clínica</p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        {canNewEncounter && (
          <Link href="/atenciones/nueva" className="btn btn-primary flex items-center gap-2">
            <FiPlus className="w-4 h-4" />
            Nueva Atención
          </Link>
        )}
        {canNewPatient && (
          <Link href="/pacientes/nuevo" className="btn btn-secondary flex items-center gap-2">
            <FiUsers className="w-4 h-4" />
            Nuevo Paciente
          </Link>
        )}
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-6"><div className="h-16 skeleton rounded" /></div>
          ))}
        </div>
      ) : data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                <FiActivity className="w-5 h-5 text-primary-600" />
              </div>
              <span className="text-2xl font-bold text-slate-900">{data.counts.total}</span>
            </div>
            <p className="text-sm text-slate-600">Total atenciones</p>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <FiClock className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-2xl font-bold text-slate-900">{data.counts.enProgreso}</span>
            </div>
            <p className="text-sm text-slate-600">En progreso</p>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-clinical-100 flex items-center justify-center">
                <FiCheckCircle className="w-5 h-5 text-clinical-600" />
              </div>
              <span className="text-2xl font-bold text-slate-900">{data.counts.completado}</span>
            </div>
            <p className="text-sm text-slate-600">Completadas</p>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <FiXCircle className="w-5 h-5 text-slate-500" />
              </div>
              <span className="text-2xl font-bold text-slate-900">{data.counts.cancelado}</span>
            </div>
            <p className="text-sm text-slate-600">Canceladas</p>
          </div>
        </div>
      )}

      {/* Pending (En Progreso) Panel */}
      {data && data.recent.filter((e) => e.status === 'EN_PROGRESO').length > 0 && (
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <h2 className="font-semibold text-slate-900">Atenciones pendientes</h2>
            </div>
            <Link href="/atenciones?status=EN_PROGRESO" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Ver todas →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recent.filter((e) => e.status === 'EN_PROGRESO').map((enc) => (
              <Link
                key={enc.id}
                href={`/atenciones/${enc.id}`}
                className="flex items-center gap-4 py-3 hover:bg-slate-50 -mx-4 px-4 rounded-lg transition-colors group"
              >
                <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <FiClock className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-slate-900 group-hover:text-primary-600">{enc.patientName}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 max-w-32 bg-slate-200 rounded-full h-1.5">
                      <div
                        className="bg-amber-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${enc.progress.total > 0 ? (enc.progress.completed / enc.progress.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{enc.progress.completed}/{enc.progress.total}</span>
                  </div>
                </div>
                <span className="text-xs text-slate-400">{format(new Date(enc.updatedAt), "d MMM HH:mm", { locale: es })}</span>
                <FiChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary-600" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Encounters */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Últimas atenciones</h2>
          <Link href="/atenciones" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            Ver todas →
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 skeleton rounded-lg" />
            ))}
          </div>
        ) : data?.recent && data.recent.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {data.recent.map((enc) => (
              <Link
                key={enc.id}
                href={`/atenciones/${enc.id}`}
                className="flex items-center gap-4 py-3 hover:bg-slate-50 -mx-4 px-4 rounded-lg transition-colors group"
              >
                <div className={clsx(
                  'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                  enc.status === 'COMPLETADO' ? 'bg-clinical-100 text-clinical-600'
                    : enc.status === 'EN_PROGRESO' ? 'bg-amber-100 text-amber-600'
                    : 'bg-slate-100 text-slate-500',
                )}>
                  <FiFileText className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 truncate group-hover:text-primary-600">
                      {enc.patientName}
                    </span>
                    <span className={clsx(
                      'text-xs px-2 py-0.5 rounded-full',
                      enc.status === 'COMPLETADO' ? 'bg-clinical-100 text-clinical-700'
                        : enc.status === 'EN_PROGRESO' ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-700',
                    )}>
                      {STATUS_LABELS[enc.status]}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-3">
                    <span>{format(new Date(enc.updatedAt), "d MMM, HH:mm", { locale: es })}</span>
                    <span>{enc.progress.completed}/{enc.progress.total} secciones</span>
                  </div>
                </div>
                <FiChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary-600" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <FiFileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p>No hay atenciones recientes</p>
          </div>
        )}
      </div>
    </div>
  );
}
