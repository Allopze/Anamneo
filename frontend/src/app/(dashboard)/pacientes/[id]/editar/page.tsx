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
import PossiblePatientDuplicatesNotice from '@/components/common/PossiblePatientDuplicatesNotice';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { getPatientCompletenessMeta } from '@/lib/patient';
import { calculateAgeFromBirthDate, todayLocalDateString } from '@/lib/date';
import { invalidateDashboardOverviewQueries } from '@/lib/query-invalidation';
import type { PatientPrevision, PatientSexo } from '@/types';
import { type EditForm, buildEditSchema } from './editar.constants';

function formatBirthDateSummary(value?: string | null) {
  if (!value) return 'Sin fecha registrada';
  return value.slice(0, 10);
}

export default function EditarPacientePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isMedico, canEditPatientAdmin } = useAuthStore();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isDoctor = isMedico();
  const canEditAdminFields = canEditPatientAdmin();

  useEffect(() => {
    if (!user) return;
    if (!canEditAdminFields) {
      router.push(`/pacientes/${id}`);
    }
  }, [user, canEditAdminFields, router, id]);

  const editSchema = useMemo(() => buildEditSchema(isDoctor), [isDoctor]);

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      fechaNacimiento: '',
      sexo: null,
      prevision: null,
      trabajo: '',
      domicilio: '',
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

    const common = {
      fechaNacimiento: data.fechaNacimiento || undefined,
      edad: calculatedAge?.edad ?? null,
      edadMeses: calculatedAge?.edadMeses ?? null,
      sexo: data.sexo,
      prevision: data.prevision,
      trabajo: data.trabajo ?? '',
      domicilio: data.domicilio ?? '',
      centroMedico: data.centroMedico ?? '',
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
    <div className="max-w-3xl mx-auto animate-fade-in pb-12">
      <div className="mb-6 flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/pacientes/${id}`}
              className="p-2 transition-colors hover:bg-surface-muted rounded-lg"
            >
              <FiArrowLeft className="w-5 h-5 text-ink-secondary" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-ink-primary">Editar paciente</h1>
              <p className="text-ink-secondary">
                Ajusta la ficha de <span className="font-semibold text-ink-primary">{patient.nombre}</span> sin perder
                contexto clínico.
              </p>
            </div>
          </div>
          <Link href={`/pacientes/${id}`} className="btn btn-secondary text-sm">
            Volver a ficha
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="section-block space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Alcance
            </p>
            <p className="text-sm font-semibold text-ink-primary">{editScopeLabel}</p>
            <p className="text-sm text-ink-secondary">
              {isDoctor
                ? 'Puedes corregir identificación y datos demográficos.'
                : 'El resto de la ficha clínica permanece bloqueado.'}
            </p>
          </div>

          <div className="section-block space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Registro actual
            </p>
            <p className="text-sm font-semibold text-ink-primary">{completenessMeta.label}</p>
            <p className="text-sm text-ink-secondary">{completenessMeta.description}</p>
          </div>

          <div className="section-block space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Identificación base
            </p>
            <p className="text-sm font-semibold text-ink-primary">{rutStatusLabel}</p>
            <p className="text-sm text-ink-secondary">
              Nacimiento: {formatBirthDateSummary(patient.fechaNacimiento)}
            </p>
          </div>
        </div>

        <div className={clsx('section-callout', formStatusTone)}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">{formStatusLabel}</p>
              <p className="mt-1 text-sm">
                {isSaving
                  ? 'Estamos persistiendo los cambios del formulario.'
                  : errorCount > 0
                    ? 'Corrige los campos marcados antes de guardar.'
                    : isDirty
                      ? 'Los cambios todavía existen solo en esta sesión.'
                      : 'Puedes revisar y salir si no necesitas modificar nada más.'}
              </p>
            </div>
            <p className="text-sm text-ink-secondary">
              Paciente: <span className="font-semibold text-ink-primary">{patient.nombre}</span>
            </p>
          </div>
        </div>
      </div>

      {!isDoctor && (
        <div className="mb-6 section-callout section-callout-warning">
          <p className="text-sm font-medium">Solo puedes editar datos administrativos del paciente.</p>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6">
          <ErrorAlert message={errorMsg} />
        </div>
      )}

      <div className="mb-6">
        <PossiblePatientDuplicatesNotice
          nombre={watchedNombre || patient.nombre}
          fechaNacimiento={watchedFechaNacimiento}
          rut={watchedRut}
          rutExempt={Boolean(rutExempt)}
          excludePatientId={patient.id}
        />
      </div>

      <form id="edit-paciente-form" onSubmit={onSubmit} className="space-y-6">
        {isDoctor && (
          <section className="section-block space-y-5">
            <div>
              <h2 className="section-block-title">Identificación</h2>
              <p className="section-block-description">
                Mantén aquí los datos que más influyen en búsqueda, deduplicación y contexto clínico.
              </p>
            </div>

            <div>
              <label htmlFor="nombre" className="form-label">Nombre completo</label>
              <input
                id="nombre"
                autoComplete="name"
                className={clsx('form-input', editForm.formState.errors.nombre && 'form-input-error')}
                {...editForm.register('nombre')}
              />
              {editForm.formState.errors.nombre && (
                <p className="form-error">{String(editForm.formState.errors.nombre.message || '')}</p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <label htmlFor="rut" className="form-label">RUT</label>
                <input
                  id="rut"
                  className={clsx('form-input', editForm.formState.errors.rut && 'form-input-error')}
                  disabled={Boolean(rutExempt)}
                  placeholder="Ej: 12.345.678-9"
                  autoComplete="off"
                  spellCheck={false}
                  {...editForm.register('rut')}
                />
                {editForm.formState.errors.rut && (
                  <p className="form-error">{String(editForm.formState.errors.rut.message || '')}</p>
                )}
              </div>

              <div className="section-block-muted flex items-center">
                <label htmlFor="rutExempt" className="flex items-start gap-3">
                  <input
                    id="rutExempt"
                    type="checkbox"
                    className="mt-0.5 rounded border-surface-muted/30 text-accent focus:ring-accent"
                    {...editForm.register('rutExempt')}
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink-primary">Paciente sin RUT</span>
                    <span className="mt-1 block text-sm text-ink-secondary">
                      Úsalo solo cuando la identificación formal todavía no exista.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {Boolean(rutExempt) && (
              <div className="section-callout section-callout-subtle">
                <label htmlFor="rutExemptReason" className="form-label">Motivo de exención</label>
                <input
                  id="rutExemptReason"
                  className={clsx(
                    'form-input',
                    editForm.formState.errors.rutExemptReason && 'form-input-error',
                  )}
                  placeholder="Ej: extranjero o recién nacido"
                  autoComplete="off"
                  {...editForm.register('rutExemptReason')}
                />
                {editForm.formState.errors.rutExemptReason && (
                  <p className="form-error">
                    {String(editForm.formState.errors.rutExemptReason.message || '')}
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        <section className="section-block space-y-5">
          <div>
            <h2 className="section-block-title">Datos demográficos</h2>
            <p className="section-block-description">
              Revisa edad y variables demográficas antes de guardar para evitar inconsistencias longitudinales.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="fechaNacimiento" className="form-label">Fecha de nacimiento</label>
              <input
                id="fechaNacimiento"
                type="date"
                max={todayLocalDateString()}
                autoComplete="bday"
                className={clsx('form-input', editForm.formState.errors.fechaNacimiento && 'form-input-error')}
                {...editForm.register('fechaNacimiento')}
              />
              {editForm.formState.errors.fechaNacimiento && (
                <p className="form-error">{String(editForm.formState.errors.fechaNacimiento.message || '')}</p>
              )}
            </div>

            <div>
              <label htmlFor="edadCalculada" className="form-label">Edad calculada</label>
              <input
                id="edadCalculada"
                type="text"
                readOnly
                tabIndex={-1}
                className="form-input bg-surface-inset text-ink-secondary cursor-default"
                value={
                  edadCalculada
                    ? `${edadCalculada.edad} años ${edadCalculada.edadMeses} meses`
                    : 'Ingrese fecha de nacimiento'
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="sexo" className="form-label">Sexo</label>
              <select
                id="sexo"
                className={clsx('form-input', editForm.formState.errors.sexo && 'form-input-error')}
                {...editForm.register('sexo', {
                  setValueAs: (value) => value === '' ? null : value,
                })}
              >
                <option value="">Sin definir</option>
                <option value="MASCULINO">Masculino</option>
                <option value="FEMENINO">Femenino</option>
                <option value="OTRO">Otro</option>
                <option value="PREFIERE_NO_DECIR">Prefiere no decir</option>
              </select>
              {editForm.formState.errors.sexo && (
                <p className="form-error">{editForm.formState.errors.sexo.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="prevision" className="form-label">Previsión</label>
              <select
                id="prevision"
                className={clsx('form-input', editForm.formState.errors.prevision && 'form-input-error')}
                {...editForm.register('prevision', {
                  setValueAs: (value) => value === '' ? null : value,
                })}
              >
                <option value="">Sin definir</option>
                <option value="FONASA">FONASA</option>
                <option value="ISAPRE">ISAPRE</option>
                <option value="OTRA">Otra</option>
                <option value="DESCONOCIDA">Desconocida</option>
              </select>
              {editForm.formState.errors.prevision && (
                <p className="form-error">{editForm.formState.errors.prevision.message}</p>
              )}
            </div>
          </div>
        </section>

        <section className="section-block space-y-5">
          <div>
            <h2 className="section-block-title">Contexto administrativo</h2>
            <p className="section-block-description">
              Estos campos ayudan a ubicar al paciente y a ordenar la operación diaria sin alterar la ficha clínica.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="trabajo" className="form-label">Trabajo / ocupación</label>
              <input
                id="trabajo"
                autoComplete="organization-title"
                className="form-input"
                {...editForm.register('trabajo')}
              />
            </div>

            <div>
              <label htmlFor="centroMedico" className="form-label">Centro médico</label>
              <input
                id="centroMedico"
                autoComplete="organization"
                className="form-input"
                {...editForm.register('centroMedico')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="domicilio" className="form-label">Domicilio</label>
            <input
              id="domicilio"
              autoComplete="street-address"
              className="form-input"
              {...editForm.register('domicilio')}
            />
          </div>
        </section>

        <div className="sticky bottom-4 z-10 rounded-card border border-surface-muted/40 bg-surface-elevated/95 p-4 shadow-soft backdrop-blur-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink-primary">{formStatusLabel}</p>
              <p className="mt-1 text-sm text-ink-secondary">
                {errorCount > 0
                  ? 'Antes de guardar, revisa los campos resaltados.'
                  : isDirty
                    ? 'Cuando guardes, volverás a la ficha del paciente.'
                    : 'No hay cambios pendientes; puedes volver a la ficha cuando quieras.'}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <Link href={`/pacientes/${id}`} className="btn btn-secondary">
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={isSaving}
                className="btn btn-primary"
              >
                {isSaving ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Guardando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <FiSave className="w-4 h-4" />
                    Guardar cambios
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
