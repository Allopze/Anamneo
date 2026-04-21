'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { api, getErrorMessage } from '@/lib/api';
import { Patient } from '@/types';
import { useAuthStore } from '@/stores/auth-store';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { FiArrowLeft } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { getPatientCompletenessMeta } from '@/lib/patient';
import { calculateAgeFromBirthDate } from '@/lib/date';
import { invalidateDashboardOverviewQueries } from '@/lib/query-invalidation';
import type { PatientPrevision, PatientSexo } from '@/types';
import { type EditForm, buildEditSchema } from './editar.constants';
import { RouteAccessGate } from '@/components/common/RouteAccessGate';
import { EditarPacienteFormSections } from './EditarPacienteFormSections';

export default function EditarPacientePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isMedico, canEditPatientAdmin } = useAuthStore();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isDoctor = isMedico();
  const canEditAdminFields = canEditPatientAdmin();

  const editSchema = useMemo(() => buildEditSchema(isDoctor), [isDoctor]);

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      fechaNacimiento: '',
      sexo: null,
      prevision: null,
      trabajo: '',
      domicilio: '',
      telefono: '',
      email: '',
      contactoEmergenciaNombre: '',
      contactoEmergenciaTelefono: '',
      centroMedico: '',
      nombre: '',
      rut: '',
      rutExempt: false,
      rutExemptReason: '',
    },
  });

  const { data: patient, isLoading, error: loadError } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const response = await api.get(`/patients/${id}`);
      return response.data as Patient;
    },
    enabled: Boolean(user && canEditAdminFields),
  });

  const initializedPatientIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!patient) return;
    if (initializedPatientIdRef.current === patient.id) return;
    initializedPatientIdRef.current = patient.id;

    editForm.reset({
      fechaNacimiento: patient.fechaNacimiento ? patient.fechaNacimiento.slice(0, 10) : '',
      sexo: patient.sexo,
      prevision: patient.prevision,
      trabajo: patient.trabajo ?? '',
      domicilio: patient.domicilio ?? '',
      telefono: patient.telefono ?? '',
      email: patient.email ?? '',
      contactoEmergenciaNombre: patient.contactoEmergenciaNombre ?? '',
      contactoEmergenciaTelefono: patient.contactoEmergenciaTelefono ?? '',
      centroMedico: patient.centroMedico ?? '',
      nombre: patient.nombre ?? '',
      rut: patient.rut ?? '',
      rutExempt: Boolean(patient.rutExempt),
      rutExemptReason: patient.rutExemptReason ?? '',
    });
  }, [patient, editForm]);

  type UpdateAdminPayload = {
    fechaNacimiento?: string | null;
    edad?: number | null;
    edadMeses?: number | null;
    sexo: PatientSexo | null;
    prevision: PatientPrevision | null;
    trabajo?: string | null;
    domicilio?: string | null;
    telefono?: string | null;
    email?: string | null;
    contactoEmergenciaNombre?: string | null;
    contactoEmergenciaTelefono?: string | null;
    centroMedico?: string | null;
  };

  const updateAdminMutation = useMutation({
    mutationFn: (payload: UpdateAdminPayload) => api.put(`/patients/${id}/admin`, payload),
    onSuccess: async () => {
      toast.success('Paciente actualizado');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['patient', id] }),
        invalidateDashboardOverviewQueries(queryClient),
      ]);
      router.push(`/pacientes/${id}`);
    },
    onError: (err) => {
      const msg = getErrorMessage(err);
      setErrorMsg(msg);
      toast.error(msg);
    },
  });

  const updateFullMutation = useMutation({
    mutationFn: (payload: Partial<EditForm>) => api.put(`/patients/${id}`, payload),
    onSuccess: async () => {
      toast.success('Paciente actualizado');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['patient', id] }),
        invalidateDashboardOverviewQueries(queryClient),
      ]);
      router.push(`/pacientes/${id}`);
    },
    onError: (err) => {
      const msg = getErrorMessage(err);
      setErrorMsg(msg);
      toast.error(msg);
    },
  });

  const onSubmit = editForm.handleSubmit((data) => {
    setErrorMsg(null);

    const calculatedAge = data.fechaNacimiento ? calculateAgeFromBirthDate(data.fechaNacimiento) : null;
    const normalizeOptionalText = (value?: string | null) => {
      const normalized = value?.trim();
      return normalized ? normalized : null;
    };

    const common = {
      fechaNacimiento: data.fechaNacimiento || undefined,
      edad: calculatedAge?.edad ?? null,
      edadMeses: calculatedAge?.edadMeses ?? null,
      sexo: data.sexo,
      prevision: data.prevision,
      trabajo: normalizeOptionalText(data.trabajo),
      domicilio: normalizeOptionalText(data.domicilio),
      telefono: normalizeOptionalText(data.telefono),
      email: normalizeOptionalText(data.email),
      contactoEmergenciaNombre: normalizeOptionalText(data.contactoEmergenciaNombre),
      contactoEmergenciaTelefono: normalizeOptionalText(data.contactoEmergenciaTelefono),
      centroMedico: normalizeOptionalText(data.centroMedico),
    };

    if (isDoctor) {
      const payload: Partial<EditForm> & { edad?: number | null; edadMeses?: number | null } = {
        ...common,
        nombre: data.nombre?.trim(),
        rutExempt: Boolean(data.rutExempt),
        rutExemptReason: data.rutExemptReason?.trim() || null,
      };

      if (!payload.rutExempt) {
        const rutVal = (data.rut ?? '').trim();
        payload.rut = rutVal.length > 0 ? rutVal : null;
      }

      updateFullMutation.mutate(payload);
      return;
    }

    updateAdminMutation.mutate(common);
  });

  const rutExempt = editForm.watch('rutExempt');
  const watchedNombre = editForm.watch('nombre');
  const watchedRut = editForm.watch('rut');
  const watchedFechaNacimiento = editForm.watch('fechaNacimiento');
  const edadCalculada = useMemo(
    () => (watchedFechaNacimiento ? calculateAgeFromBirthDate(watchedFechaNacimiento) : null),
    [watchedFechaNacimiento],
  );

  if (user && !canEditAdminFields) {
    return (
      <RouteAccessGate
        when={true}
        title="Redirigiendo…"
        description="No tienes permisos para editar esta ficha. Te llevamos de vuelta al paciente."
        href={`/pacientes/${id}`}
        actionLabel="Volver a ficha"
      />
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 skeleton rounded-lg" />
          <div>
            <div className="h-6 skeleton rounded w-48 mb-2" />
            <div className="h-4 skeleton rounded w-32" />
          </div>
        </div>
        <div className="card space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-4 skeleton rounded w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (loadError || !patient) {
    return (
      <div className="max-w-3xl mx-auto animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href={`/pacientes/${id}`}
            className="p-2 transition-colors hover:bg-surface-muted rounded-lg"
          >
            <FiArrowLeft className="w-5 h-5 text-ink-secondary" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-ink-primary">Editar paciente</h1>
            <p className="text-ink-secondary">No se pudo cargar el paciente</p>
          </div>
        </div>
        <ErrorAlert message={getErrorMessage(loadError ?? new Error('Paciente no encontrado'))} />
      </div>
    );
  }

  const completenessMeta = getPatientCompletenessMeta(patient);
  const isSaving = updateAdminMutation.isPending || updateFullMutation.isPending;
  const isDirty = editForm.formState.isDirty;
  const errorCount = Object.keys(editForm.formState.errors).length;
  const formStatusLabel = isSaving
    ? 'Guardando cambios...'
    : errorCount > 0
      ? `${errorCount} campo(s) requieren revisión`
      : isDirty
        ? 'Hay cambios sin guardar'
        : 'Sin cambios pendientes';
  const formStatusTone = errorCount > 0
    ? 'section-callout-warning'
    : isDirty
      ? 'section-callout-info'
      : 'section-callout-subtle';
  const editScopeLabel = isDoctor ? 'Edición clínica completa' : 'Solo edición administrativa';
  const rutStatusLabel = patient.rutExempt ? 'Paciente sin RUT' : patient.rut || 'Sin RUT registrado';

  return (
    <EditarPacienteFormSections
      id={id}
      patient={patient}
      isDoctor={isDoctor}
      errorMsg={errorMsg}
      editForm={editForm}
      rutExempt={Boolean(rutExempt)}
      watchedNombre={watchedNombre ?? ''}
      watchedRut={watchedRut ?? ''}
      watchedFechaNacimiento={watchedFechaNacimiento ?? ''}
      edadCalculada={edadCalculada}
      completenessLabel={completenessMeta.label}
      completenessDescription={completenessMeta.description}
      editScopeLabel={editScopeLabel}
      rutStatusLabel={rutStatusLabel}
      formStatusLabel={formStatusLabel}
      formStatusTone={formStatusTone}
      isSaving={isSaving}
      isDirty={isDirty}
      errorCount={errorCount}
      onSubmit={onSubmit}
    />
  );
}
