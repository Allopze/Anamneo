'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import PossiblePatientDuplicatesNotice from '@/components/common/PossiblePatientDuplicatesNotice';
import { validateRut } from '@/lib/rut';
import { calculateAgeFromBirthDate, todayLocalDateString } from '@/lib/date';
import { basePatientSchema, fullPatientSchema, PatientForm } from './nuevo.constants';
import { RouteAccessGate } from '@/components/common/RouteAccessGate';

export default function NuevoPacientePage() {
  const router = useRouter();
  const { user, isMedico, canCreatePatient } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDoctor = isMedico();
  const canCreate = canCreatePatient();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PatientForm>({
    resolver: zodResolver(isDoctor ? fullPatientSchema : basePatientSchema),
    defaultValues: {
      sexo: '' as any,
      prevision: '' as any,
      rutExempt: false,
    },
  });

  const rutExempt = watch('rutExempt');
  const nombre = watch('nombre');
  const rut = watch('rut');
  const fechaNacimiento = watch('fechaNacimiento');
  const todayDateValue = useMemo(() => todayLocalDateString(), []);
  const edadCalculada = useMemo(
    () => (fechaNacimiento ? calculateAgeFromBirthDate(fechaNacimiento) : null),
    [fechaNacimiento],
  );

  if (user && !canCreate) {
    return (
      <RouteAccessGate
        when={true}
        title="Redirigiendo…"
        description="No tienes permisos para crear pacientes. Te llevamos a la lista."
        href="/pacientes"
        actionLabel="Ir a pacientes"
      />
    );
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
      const calculatedAge = data.fechaNacimiento
        ? calculateAgeFromBirthDate(data.fechaNacimiento)
        : null;

      if (isDoctor && !calculatedAge) {
        setError('Debe ingresar una fecha de nacimiento válida');
        setIsLoading(false);
        return;
      }

      const payload = isDoctor
        ? {
            nombre: data.nombre,
            fechaNacimiento: data.fechaNacimiento || undefined,
            edad: calculatedAge?.edad,
            edadMeses: calculatedAge?.edadMeses,
            sexo: data.sexo,
            prevision: data.prevision,
            trabajo: data.trabajo,
            domicilio: data.domicilio,
            centroMedico: data.centroMedico,
            rut: data.rutExempt ? undefined : formattedRut,
            rutExempt: data.rutExempt,
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
            {isDoctor ? 'Ingresa los datos del paciente' : 'Registro rápido para recepción'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorAlert message={error} />
        </div>
      )}

      {!isDoctor && (
        <div className="mb-6 rounded-lg border border-status-yellow/70 bg-status-yellow/40 p-4 text-sm text-accent-text">
          Solo se requieren los datos mínimos de recepción. La ficha quedará como incompleta hasta que se completen edad, sexo, previsión y validación médica.
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

        <PossiblePatientDuplicatesNotice
          nombre={nombre}
          fechaNacimiento={fechaNacimiento}
          rut={rut}
          rutExempt={rutExempt}
        />

        {isDoctor && (
          <>
        {/* Fecha de nacimiento y Sexo */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="fechaNacimiento" className="form-label">
              Fecha de nacimiento *
            </label>
            <input
              id="fechaNacimiento"
              type="date"
              max={todayDateValue}
              className={`form-input ${errors.fechaNacimiento ? 'form-input-error' : ''}`}
              {...register('fechaNacimiento')}
            />
            {errors.fechaNacimiento && <p className="form-error">{errors.fechaNacimiento.message}</p>}
          </div>
          <div>
            <label htmlFor="edadCalculada" className="form-label">
              Edad calculada
            </label>
            <input
              id="edadCalculada"
              type="text"
              readOnly
              className="form-input bg-surface-muted/30"
              value={
                edadCalculada
                  ? `${edadCalculada.edad} años ${edadCalculada.edadMeses} meses`
                  : 'Completa la fecha de nacimiento'
              }
            />
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

        {/* Centro Médico */}
        <div>
          <label htmlFor="centroMedico" className="form-label">
            Centro médico
          </label>
          <input
            id="centroMedico"
            type="text"
            className="form-input"
            placeholder="Ej: Hospital Clínico UC, Clínica Santa María"
            {...register('centroMedico')}
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
