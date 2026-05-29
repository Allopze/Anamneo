'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiDownload } from 'react-icons/fi';
import { api } from '@/lib/api';
import { todayLocalDateString } from '@/lib/date';
import { notify } from '@/lib/notify';

export default function PatientsOperationalExportPanel() {
  const [fromDate, setFromDate] = useState(todayLocalDateString());
  const [toDate, setToDate] = useState(todayLocalDateString());
  const [medicoId, setMedicoId] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users-for-operational-export'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data as Array<{
        id: string;
        nombre: string;
        email: string;
        role: string;
        active: boolean;
      }>;
    },
  });

  const medicos = users.filter((user) => user.active && user.role === 'MEDICO');

  const exportOperationalEncounters = async () => {
    if (!fromDate || !toDate) {
      notify.error('Selecciona el rango de fechas');
      return;
    }

    setIsExporting(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate });
      if (medicoId) {
        params.set('medicoId', medicoId);
      }

      const res = await api.get(`/patients/export/operational-encounters.csv?${params.toString()}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `atenciones_operativas_${fromDate}_${toDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      notify.success('Exportacion operativa descargada');
    } catch {
      notify.error('Error al exportar atenciones');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mt-4 border-t border-surface-muted/40 pt-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <label htmlFor="operational-export-from" className="block text-micro text-ink-muted mb-1">
            Desde
          </label>
          <input
            id="operational-export-from"
            type="date"
            className="input w-full text-sm"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="operational-export-to" className="block text-micro text-ink-muted mb-1">
            Hasta
          </label>
          <input
            id="operational-export-to"
            type="date"
            className="input w-full text-sm"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="operational-export-medico" className="block text-micro text-ink-muted mb-1">
            Medico
          </label>
          <select
            id="operational-export-medico"
            className="input w-full text-sm"
            value={medicoId}
            onChange={(e) => setMedicoId(e.target.value)}
          >
            <option value="">Todos</option>
            {medicos.map((medico) => (
              <option key={medico.id} value={medico.id}>
                {medico.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            className="btn btn-secondary w-full"
            disabled={isExporting}
            onClick={exportOperationalEncounters}
          >
            <FiDownload className="w-4 h-4" />
            Exportar atenciones
          </button>
        </div>
      </div>
    </div>
  );
}
