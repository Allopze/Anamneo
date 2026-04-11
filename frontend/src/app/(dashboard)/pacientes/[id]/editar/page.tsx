'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { api, getErrorMessage } from '@/lib/api';
import { Patient } from '@/types';
import { useAuthStore } from '@/stores/auth-store';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { validateRut } from '@/lib/rut';
import { getPatientCompletenessMeta } from '@/lib/patient';
import type { PatientPrevision, PatientSexo } from '@/types';

type EditForm = {
  fechaNacimiento: string;
  sexo: PatientSexo | null;
  prevision: PatientPrevision | null;
  trabajo?: string | null;
  domicilio?: string | null;
  nombre?: string;
  rut?: string | null;
  rutExempt?: boolean;
  rutExemptReason?: string | null;
};

function calculateAgeFromBirthDate(dateValue: string): { edad: number; edadMeses: number } | null {
  const [yearStr, monthStr, dayStr] = dateValue.split('-');
  const year = Number.parseInt(yearStr ?? '', 10);
  const month = Number.parseInt(monthStr ?? '', 10);
  const day = Number.parseInt(dayStr ?? '', 10);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;

  const birthDate = new Date(Date.UTC(year, month - 1, day));
  if (birthDate.getUTCFullYear() !== year || birthDate.getUTCMonth() !== month - 1 || birthDate.getUTCDate() !== day) return null;

  const now = new Date();
  let totalMonths = (now.getUTCFullYear() - year) * 12 + (now.getUTCMonth() - (month - 1));
  if (now.getUTCDate() < day) totalMonths -= 1;
  if (totalMonths < 0 || Math.floor(totalMonths / 12) > 150) return null;

  return { edad: Math.floor(totalMonths / 12), edadMeses: totalMonths % 12 };
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

  const editSchema = useMemo(() => {
    const base = z.object({
      fechaNacimiento: z.string().optional().default(''),
      sexo: z.enum(['MASCULINO', 'FEMENINO', 'OTRO', 'PREFIERE_NO_DECIR']).nullable(),
      prevision: z.enum(['FONASA', 'ISAPRE', 'OTRA', 'DESCONOCIDA']).nullable(),
      trabajo: z.string().nullable().optional(),
      domicilio: z.string().nullable().optional(),
    });

    if (!isDoctor) return base;

    return base
      .extend({
        nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
        rut: z.string().nullable().optional(),
        rutExempt: z.boolean().default(false),
        rutExemptReason: z.string().nullable().optional(),
      })
      .superRefine((val, ctx) => {
        const anyVal = val as EditForm;
        if (anyVal.rutExempt) {
          if (!anyVal.rutExemptReason || anyVal.rutExemptReason.trim().length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['rutExemptReason'],
              message: 'Debe indicar el motivo de exencion de RUT',
            });
          }
        } else if (anyVal.rut && anyVal.rut.trim().length > 0 && !validateRut(anyVal.rut).valid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rut'],
            message: 'RUT inválido (ej: 12.345.678-5)',
          });
        }
      });
  }, [isDoctor]);

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      fechaNacimiento: '',
      sexo: null,
      prevision: null,
      trabajo: '',
      domicilio: '',
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
  };

  const updateAdminMutation = useMutation({
    mutationFn: (payload: UpdateAdminPayload) =>
      api.put(`/patients/${id}/admin`, payload),
    onSuccess: () => {
      toast.success('Paciente actualizado');
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
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
    onSuccess: () => {
      toast.success('Paciente actualizado');
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
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

    const calculatedAge = data.fechaNacimiento
      ? calculateAgeFromBirthDate(data.fechaNacimiento)
      : null;

    const common = {
      fechaNacimiento: data.fechaNacimiento || undefined,
      edad: calculatedAge?.edad ?? null,
      edadMeses: calculatedAge?.edadMeses ?? null,
      sexo: data.sexo,
      prevision: data.prevision,
      trabajo: data.trabajo ?? '',
      domicilio: data.domicilio ?? '',
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
            className="p-2 hover:bg-surface-muted rounded-lg transition-colors"
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

  return (
    <div className="max-w-3xl mx-auto animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link
            href={`/pacientes/${id}`}
            className="p-2 hover:bg-surface-muted rounded-lg transition-colors"
          >
            <FiArrowLeft className="w-5 h-5 text-ink-secondary" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-ink-primary">Editar paciente</h1>
            <p className="text-ink-secondary">
              Actualiza los datos de <span className="font-semibold">{patient.nombre}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/pacientes/${id}`} className="btn btn-secondary text-sm">
            Cancelar
          </Link>
          <button
            type="submit"
            form="edit-paciente-form"
            disabled={updateAdminMutation.isPending || updateFullMutation.isPending}
            className="btn btn-primary text-sm flex items-center gap-2"
          >
            {updateAdminMutation.isPending || updateFullMutation.isPending ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <FiSave className="w-4 h-4" />
            )}
            Guardar cambios
          </button>
        </div>
      </div>

      {!isDoctor && (
        <div className="mb-6 rounded-lg border border-status-yellow/70 bg-status-yellow/40 p-4 text-sm text-accent-text">
          Solo puedes editar datos administrativos del paciente.
        </div>
      )}

      <div className="mb-6 rounded-lg border border-surface-muted/30 bg-surface-elevated p-4 text-sm text-ink-secondary">
        <p className="font-medium text-ink-primary">{completenessMeta.label}</p>
        <p className="mt-1">{completenessMeta.description}</p>
      </div>

      {errorMsg && (
        <div className="mb-6">
          <ErrorAlert message={errorMsg} />
        </div>
      )}

      <form id="edit-paciente-form" onSubmit={onSubmit} className="card space-y-6">
        {isDoctor && (
          <>
            <div>
              <label className="form-label">Nombre completo</label>
              <input
                className={clsx('form-input', editForm.formState.errors.nombre && 'form-input-error')}
                {...editForm.register('nombre')}
              />
              {editForm.formState.errors.nombre && (
                <p className="form-error">{String(editForm.formState.errors.nombre.message || '')}</p>
              )}
            </div>

            <div>
              <label className="form-label">RUT</label>
              <div className="space-y-2">
                <input
                  className={clsx('form-input', editForm.formState.errors.rut && 'form-input-error')}
                  disabled={Boolean(rutExempt)}
                  placeholder="Ej: 12.345.678-9"
                  {...editForm.register('rut')}
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-surface-muted/30 text-accent focus:ring-accent"
                    {...editForm.register('rutExempt')}
                  />
                  <span className="text-sm text-ink-secondary">Paciente sin RUT</span>
                </label>
                {Boolean(rutExempt) && (
                  <>
                    <input
                      className={clsx(
                        'form-input',
                        editForm.formState.errors.rutExemptReason && 'form-input-error'
                      )}
                      placeholder="Motivo de exencion (ej: extranjero, recien nacido)"
                      {...editForm.register('rutExemptReason')}
                    />
                    {editForm.formState.errors.rutExemptReason && (
                      <p className="form-error">
                        {String(editForm.formState.errors.rutExemptReason.message || '')}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Fecha de nacimiento</label>
            <input
              type="date"
              max={new Date().toISOString().split('T')[0]}
              className={clsx('form-input', editForm.formState.errors.fechaNacimiento && 'form-input-error')}
              {...editForm.register('fechaNacimiento')}
            />
            {editForm.formState.errors.fechaNacimiento && (
              <p className="form-error">{String(editForm.formState.errors.fechaNacimiento.message || '')}</p>
            )}
          </div>

          <div>
            <label className="form-label">Edad calculada</label>
            <input
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Sexo</label>
            <select
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
        </div>

        <div>
          <label className="form-label">Prevision</label>
          <select
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

        <div>
          <label className="form-label">Trabajo / Ocupacion</label>
          <input className="form-input" {...editForm.register('trabajo')} />
        </div>

        <div>
          <label className="form-label">Domicilio</label>
          <input className="form-input" {...editForm.register('domicilio')} />
        </div>

        <div className="pt-4 border-t border-surface-muted/30 flex items-center justify-end gap-3">
          <Link href={`/pacientes/${id}`} className="btn btn-secondary">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={updateAdminMutation.isPending || updateFullMutation.isPending}
            className="btn btn-primary"
          >
            {updateAdminMutation.isPending || updateFullMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Guardando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <FiSave className="w-4 h-4" />
                Guardar
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
