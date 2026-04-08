'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Patient, PatientHistory } from '@/types';
import { FiArrowLeft, FiSave, FiAlertCircle, FiClipboard } from 'react-icons/fi';
import Link from 'next/link';
import toast from 'react-hot-toast';
import ConditionSelector from '@/components/common/ConditionSelector';
import { parseHistoryField } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { ErrorAlert } from '@/components/common/ErrorAlert';

const HISTORY_FIELDS = [
  { key: 'antecedentesMedicos', label: 'Antecedentes médicos', placeholder: 'Selecciona o escribe afecciones médicas...', type: 'tags' },
  { key: 'antecedentesQuirurgicos', label: 'Antecedentes quirúrgicos', placeholder: 'Cirugías previas, fechas aproximadas...', type: 'text' },
  { key: 'antecedentesGinecoobstetricos', label: 'Antecedentes ginecoobstétricos', placeholder: 'Menarquia, embarazos, menopausia...', type: 'text' },
  { key: 'antecedentesFamiliares', label: 'Antecedentes familiares', placeholder: 'Enfermedades hereditarias...', type: 'text' },
  { key: 'habitos', label: 'Hábitos', placeholder: 'Tabaco, alcohol, drogas, ejercicio...', type: 'text' },
  { key: 'medicamentos', label: 'Uso de medicamentos', placeholder: 'Medicamentos actuales, dosis, frecuencia...', type: 'text' },
  { key: 'alergias', label: 'Alergias', placeholder: 'Medicamentos, alimentos, ambientales...', type: 'tags' },
  { key: 'inmunizaciones', label: 'Inmunizaciones', placeholder: 'Vacunas recibidas, fechas...', type: 'text' },
  { key: 'antecedentesSociales', label: 'Antecedentes sociales', placeholder: 'Vivienda, trabajo, situación económica...', type: 'text' },
  { key: 'antecedentesPersonales', label: 'Antecedentes personales', placeholder: 'Otros datos relevantes...', type: 'text' },
];

export default function HistorialPacientePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, canEditAntecedentes } = useAuthStore();
  const canEditHistory = canEditAntecedentes();
  const [formData, setFormData] = useState<any>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user?.isAdmin || !canEditHistory) {
      router.push(`/pacientes/${id}`);
    }
  }, [canEditHistory, router, id, user?.isAdmin]);

  const { data: patient, isLoading, error: loadError } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const response = await api.get(`/patients/${id}`);
      return response.data as Patient;
    },
    enabled: canEditHistory && !user?.isAdmin,
  });

  const initializedPatientIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (patient?.history) {
      if (initializedPatientIdRef.current === patient.id) return;
      initializedPatientIdRef.current = patient.id;

      // Initialize form with existing history
      const initialData: any = {};
      HISTORY_FIELDS.forEach(field => {
        const rawVal = patient.history![field.key as keyof PatientHistory];
        const val = parseHistoryField(rawVal);
        
        if (field.type === 'tags') {
          initialData[field.key] = typeof val === 'object' ? val?.items || [] : [];
        } else {
          initialData[field.key] = typeof val === 'object' ? val?.texto || '' : (typeof val === 'string' ? val : '');
        }
      });
      setFormData(initialData);
    }
  }, [patient]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put(`/patients/${id}/history`, data),
    onSuccess: () => {
      toast.success('Historial actualizado correctamente');
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
      router.push(`/pacientes/${id}`);
    },
    onError: (err) => {
      const msg = getErrorMessage(err);
      setErrorMsg(msg);
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    
    // Format data for backend
    const payload: any = {};
    HISTORY_FIELDS.forEach(field => {
      if (field.type === 'tags') {
        payload[field.key] = { items: formData[field.key] || [] };
      } else {
        payload[field.key] = { texto: formData[field.key] || '' };
      }
    });

    updateMutation.mutate(payload);
  };

  const handleFieldChange = (key: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  if (!canEditHistory || user?.isAdmin) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse p-8">
        <div className="h-8 bg-surface-muted rounded w-1/3 mb-6" />
        <div className="space-y-4">
          <div className="h-32 bg-surface-muted rounded" />
          <div className="h-32 bg-surface-muted rounded" />
          <div className="h-32 bg-surface-muted rounded" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-4xl mx-auto animate-fade-in pb-12">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href={`/pacientes/${id}`}
            className="p-2 hover:bg-surface-muted rounded-card transition-colors"
          >
            <FiArrowLeft className="w-5 h-5 text-ink-secondary" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-ink-primary">Historial Clínico</h1>
            <p className="text-ink-secondary">No se pudo cargar el paciente</p>
          </div>
        </div>

        <ErrorAlert message={getErrorMessage(loadError)} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            href={`/pacientes/${id}`}
            className="p-2 hover:bg-surface-muted rounded-card transition-colors"
          >
            <FiArrowLeft className="w-5 h-5 text-ink-secondary" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-ink-primary">Historial Clínico</h1>
            <p className="text-ink-secondary">
              Antecedentes de <span className="font-semibold">{patient?.nombre}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/pacientes/${id}`} className="btn btn-secondary text-sm">
            Cancelar
          </Link>
          <button
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
            className="btn btn-primary text-sm flex items-center gap-2"
          >
            {updateMutation.isPending ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <FiSave className="w-4 h-4" />
            )}
            Guardar cambios
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {HISTORY_FIELDS.map((field) => (
            <div key={field.key} className="card border-surface-muted/30 bg-surface-elevated shadow-sm flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4 border-b border-surface-muted/20 pb-2">
                <FiClipboard className="w-4 h-4 text-accent-text" />
                <h3 className="font-semibold text-ink-primary">{field.label}</h3>
              </div>
              
              <div className="flex-1">
                {field.type === 'tags' ? (
                  <ConditionSelector
                    selected={formData[field.key] || []}
                    onChange={(tags) => handleFieldChange(field.key, tags)}
                    placeholder={field.placeholder}
                    allowCatalogPersistence
                  />
                ) : (
                  <textarea
                    value={formData[field.key] || ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={4}
                    className="form-input form-textarea h-full min-h-[100px]"
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Actions for mobile */}
        <div className="sm:hidden flex flex-col gap-3 mt-8">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="btn btn-primary w-full py-4 text-lg font-bold shadow-xl"
          >
            Guardar historial
          </button>
          <Link href={`/pacientes/${id}`} className="btn btn-secondary w-full py-4 text-lg">
            Cancelar
          </Link>
        </div>
        {errorMsg && (
          <div className="mb-6">
            <ErrorAlert message={errorMsg} />
          </div>
        )}
      </form>
    </div>
  );
}
