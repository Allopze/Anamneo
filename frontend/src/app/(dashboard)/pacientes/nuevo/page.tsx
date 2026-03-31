'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { validateRut } from '@/lib/rut';

const PATIENT_DRAFT_KEY = 'anamneo:draft:new-patient';

const basePatientObject = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  edad: z.number().min(0, 'La edad debe ser mayor a 0').max(150, 'Edad no valida').optional(),
  sexo: z.enum(['MASCULINO', 'FEMENINO', 'OTRO', 'PREFIERE_NO_DECIR']).optional(),
  prevision: z.enum(['FONASA', 'ISAPRE', 'OTRA', 'DESCONOCIDA']).optional(),
  rut: z.string().optional(),
  rutExempt: z.boolean().default(false),
  rutExemptReason: z.string().optional(),
  trabajo: z.string().optional(),
  domicilio: z.string().optional(),
});

const basePatientSchema = basePatientObject.superRefine((val, ctx) => {
  if (val.rutExempt && (!val.rutExemptReason || val.rutExemptReason.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rutExemptReason'],
      message: 'Debe indicar el motivo de exencion de RUT',
    });
  }
  if (!val.rutExempt && val.rut && val.rut.trim().length > 0 && !validateRut(val.rut).valid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rut'],
      message: 'RUT inválido (ej: 12.345.678-5)',
    });
  }
});

const fullPatientSchema = basePatientObject.extend({
  edad: z.number().min(0, 'La edad debe ser mayor a 0').max(150, 'Edad no valida'),
  sexo: z.enum(['MASCULINO', 'FEMENINO', 'OTRO', 'PREFIERE_NO_DECIR']),
  prevision: z.enum(['FONASA', 'ISAPRE', 'OTRA', 'DESCONOCIDA']),
}).superRefine((val, ctx) => {
  if (val.rutExempt && (!val.rutExemptReason || val.rutExemptReason.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rutExemptReason'],
      message: 'Debe indicar el motivo de exencion de RUT',
    });
  }
});

type PatientForm = z.infer<typeof basePatientSchema>;

export default function NuevoPacientePage() {
  const router = useRouter();
  const { user, isMedico, canCreatePatient } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDoctor = isMedico();
  const canCreate = canCreatePatient();

  useEffect(() => {
    if (!user) return;
    if (canCreate) return;
    toast.error('No tiene permisos para crear pacientes');
    router.push('/pacientes');
  }, [user, canCreate, router]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PatientForm>({
    resolver: zodResolver(isDoctor ? fullPatientSchema : basePatientSchema),
    defaultValues: {
      rutExempt: false,
    },
  });

  const rutExempt = watch('rutExempt');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const rawDraft = window.sessionStorage.getItem(PATIENT_DRAFT_KEY);
    if (!rawDraft) {
      return;
    }

    try {
      const parsedDraft = JSON.parse(rawDraft) as Partial<PatientForm>;
      for (const [field, value] of Object.entries(parsedDraft)) {
        setValue(field as keyof PatientForm, value as PatientForm[keyof PatientForm], {
          shouldValidate: false,
          shouldDirty: false,
        });
      }
    } catch {
      window.sessionStorage.removeItem(PATIENT_DRAFT_KEY);
    }
  }, [setValue]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const subscription = watch((value) => {
      window.sessionStorage.setItem(PATIENT_DRAFT_KEY, JSON.stringify(value));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [watch]);

  if (!canCreate) {
    return null;
  }

  const onSubmit = async (data: PatientForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const normalizedRut = data.rut?.trim();
      const formattedRut = normalizedRut
        ? (validateRut(normalizedRut).formatted ?? normalizedRut)
        : undefined;
      const normalizedRutExemptReason = data.rutExemptReason?.trim();

      const payload = isDoctor
        ? {
            ...data,
            rut: data.rutExempt ? undefined : formattedRut,
            rutExemptReason: data.rutExempt ? normalizedRutExemptReason : undefined,
          }
        : {
            nombre: data.nombre,
            rut: data.rutExempt ? undefined : formattedRut,
            rutExempt: data.rutExempt,
            rutExemptReason: data.rutExempt ? normalizedRutExemptReason : undefined,
          };
      const endpoint = isDoctor ? '/patients' : '/patients/quick';
      const response = await api.post(endpoint, payload);
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(PATIENT_DRAFT_KEY);
      }
      toast.success('Paciente creado correctamente');
      router.push(`/pacientes/${response.data.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/pacientes"
          className="p-2 hover:bg-surface-muted rounded-lg transition-colors"
        >
          <FiArrowLeft className="w-5 h-5 text-ink-secondary" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-ink-primary">Nuevo Paciente</h1>
          <p className="text-ink-secondary">
            {isDoctor ? 'Ingresa los datos del paciente' : 'Registro rapido para recepcion'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorAlert message={error} />
        </div>
      )}

      {!isDoctor && (
        <div className="mb-6 p-4 rounded-lg border border-status-yellow/30 bg-status-yellow/10 text-status-yellow text-sm">
          Solo se requieren datos basicos. Podras completar el resto mas tarde.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-6">
        {/* Nombre */}
        <div>
          <label htmlFor="nombre" className="form-label">
            Nombre completo *
          </label>
          <input
            id="nombre"
            type="text"
            className={`form-input ${errors.nombre ? 'form-input-error' : ''}`}
            placeholder="Ej: Juan Carlos Pérez González"
            {...register('nombre')}
          />
          {errors.nombre && <p className="form-error">{errors.nombre.message}</p>}
        </div>

        {/* RUT */}
        <div>
          <label htmlFor="rut" className="form-label">
            RUT
          </label>
          <div className="space-y-2">
            <input
              id="rut"
              type="text"
              disabled={rutExempt}
              className={`form-input ${errors.rut ? 'form-input-error' : ''}`}
              placeholder="Ej: 12.345.678-9"
              {...register('rut')}
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-surface-muted/30 text-accent focus:ring-accent"
                {...register('rutExempt')}
              />
              <span className="text-sm text-ink-secondary">Paciente sin RUT</span>
            </label>
            {rutExempt && (
              <div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Motivo de exencion (ej: extranjero, recien nacido)"
                  {...register('rutExemptReason')}
                />
                {errors.rutExemptReason && (
                  <p className="form-error">{errors.rutExemptReason.message}</p>
                )}
              </div>
            )}
          </div>
          {errors.rut && <p className="form-error">{errors.rut.message}</p>}
        </div>

        {isDoctor && (
          <>
        {/* Edad y Sexo */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="edad" className="form-label">
              Edad *
            </label>
            <input
              id="edad"
              type="number"
              min="0"
              max="150"
              className={`form-input ${errors.edad ? 'form-input-error' : ''}`}
              placeholder="Ej: 45"
              {...register('edad', { valueAsNumber: true })}
            />
            {errors.edad && <p className="form-error">{errors.edad.message}</p>}
          </div>
          <div>
            <label htmlFor="sexo" className="form-label">
              Sexo *
            </label>
            <select
              id="sexo"
              className={`form-input ${errors.sexo ? 'form-input-error' : ''}`}
              {...register('sexo')}
            >
              <option value="" disabled>Seleccione...</option>
              <option value="MASCULINO">Masculino</option>
              <option value="FEMENINO">Femenino</option>
              <option value="OTRO">Otro</option>
              <option value="PREFIERE_NO_DECIR">Prefiere no decir</option>
            </select>
            {errors.sexo && <p className="form-error">{errors.sexo.message}</p>}
          </div>
        </div>

        {/* Previsión */}
        <div>
          <label htmlFor="prevision" className="form-label">
            Previsión de salud *
          </label>
          <select
            id="prevision"
            className={`form-input ${errors.prevision ? 'form-input-error' : ''}`}
            {...register('prevision')}
          >
            <option value="" disabled>Seleccione...</option>
            <option value="FONASA">FONASA</option>
            <option value="ISAPRE">ISAPRE</option>
            <option value="OTRA">Otra</option>
            <option value="DESCONOCIDA">Desconocida</option>
          </select>
          {errors.prevision && <p className="form-error">{errors.prevision.message}</p>}
        </div>

        {/* Trabajo */}
        <div>
          <label htmlFor="trabajo" className="form-label">
            Trabajo / Ocupación
          </label>
          <input
            id="trabajo"
            type="text"
            className="form-input"
            placeholder="Ej: Ingeniero"
            {...register('trabajo')}
          />
        </div>

        {/* Domicilio */}
        <div>
          <label htmlFor="domicilio" className="form-label">
            Domicilio
          </label>
          <input
            id="domicilio"
            type="text"
            className="form-input"
            placeholder="Ej: Av. Providencia 1234, Santiago"
            {...register('domicilio')}
          />
        </div>

          </>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-muted/30">
          <Link href="/pacientes" className="btn btn-secondary">
            Cancelar
          </Link>
          <button type="submit" disabled={isLoading} className="btn btn-primary">
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Guardando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <FiSave className="w-4 h-4" />
                Guardar paciente
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
