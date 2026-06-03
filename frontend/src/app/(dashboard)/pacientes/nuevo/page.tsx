'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthCanCreatePatient, useAuthIsMedico, useAuthUser } from '@/stores/auth-store';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import Link from 'next/link';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import ConfirmModal from '@/components/common/ConfirmModal';
import PossiblePatientDuplicatesNotice from '@/components/common/PossiblePatientDuplicatesNotice';
import { notify } from '@/lib/notify';
import { validateRut, formatRut } from '@/lib/rut';
import { calculateAgeFromBirthDate, todayLocalDateString } from '@/lib/date';
import { basePatientSchema, fullPatientSchema, PatientForm } from './nuevo.constants';
import { RouteAccessGate } from '@/components/common/RouteAccessGate';
import NuevoPacienteDoctorFields from './NuevoPacienteDoctorFields';
import { usePatientFormDraft, clearPatientFormDraft } from './usePatientFormDraft';

export default function NuevoPacientePage() {
  const router = useRouter();
  const user = useAuthUser();
  const isDoctor = useAuthIsMedico();
  const canCreate = useAuthCanCreatePatient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<PatientForm>({
    resolver: zodResolver(isDoctor ? fullPatientSchema : basePatientSchema),
    defaultValues: {
      sexo: '' as any,
      prevision: '' as any,
      rutExempt: false,
    },
  });
  const { register, handleSubmit, watch, setValue, formState: { errors, isDirty } } = form;

  const draftNavigationGuard = usePatientFormDraft(form, user?.id, isDirty);

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

  const normalizeOptionalText = (value?: string) => {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  };

  const onSubmit = async (data: PatientForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const normalizedRut = data.rut?.trim();
      const formattedRut = normalizedRut
        ? (validateRut(normalizedRut).formatted ?? normalizedRut)
        : undefined;
      const normalizedRutExemptReason = data.rutExemptReason?.trim();
      const edadCalculada = data.fechaNacimiento
        ? calculateAgeFromBirthDate(data.fechaNacimiento)
        : null;

      if (isDoctor && !edadCalculada) {
        setError('Debe ingresar una fecha de nacimiento válida');
        setIsLoading(false);
        return;
      }

      const payload = isDoctor
        ? {
            nombre: data.nombre,
            fechaNacimiento: data.fechaNacimiento || undefined,
            edad: edadCalculada?.edad,
            edadMeses: edadCalculada?.edadMeses,
            sexo: data.sexo,
            prevision: data.prevision,
            trabajo: normalizeOptionalText(data.trabajo),
            domicilio: normalizeOptionalText(data.domicilio),
            telefono: normalizeOptionalText(data.telefono),
            email: normalizeOptionalText(data.email),
            contactoEmergenciaNombre: normalizeOptionalText(data.contactoEmergenciaNombre),
            contactoEmergenciaTelefono: normalizeOptionalText(data.contactoEmergenciaTelefono),
            centroMedico: normalizeOptionalText(data.centroMedico),
            // Ley 21.719 Art 16 quater (representante legal NNA)
            legalRepresentativeName: normalizeOptionalText(data.legalRepresentativeName),
            legalRepresentativeRut: normalizeOptionalText(data.legalRepresentativeRut),
            legalRepresentativeRelationship: data.legalRepresentativeRelationship || undefined,
            legalRepresentativeContact: normalizeOptionalText(data.legalRepresentativeContact),
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
      notify.success('Paciente creado correctamente');
      if (user?.id) clearPatientFormDraft(user.id);
      router.push(`/pacientes/${response.data.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/pacientes"
          className="p-2 hover:bg-surface-muted rounded-lg transition-colors"
          aria-label="Volver a pacientes"
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
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <input
                id="rut"
                type="text"
                disabled={rutExempt}
                className={`form-input ${errors.rut ? 'form-input-error' : ''}`}
                placeholder="Ej: 12.345.678-9"
                {...register('rut', {
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                    const raw = e.target.value;
                    const cleaned = raw.replace(/[.\-\s]/g, '');
                    if (cleaned.length >= 2) {
                      e.target.value = formatRut(raw);
                    }
                  },
                })}
              />
              {errors.rut && <p className="form-error">{errors.rut.message}</p>}
            </div>
            <div className="section-block-muted flex items-center">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-surface-muted/30 text-accent focus:ring-accent"
                  {...register('rutExempt')}
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
          {rutExempt && (
            <div className="section-callout section-callout-subtle mt-4">
              <label htmlFor="rutExemptReason" className="form-label">Motivo de exención</label>
              <input
                id="rutExemptReason"
                type="text"
                className={`form-input ${errors.rutExemptReason ? 'form-input-error' : ''}`}
                placeholder="Ej: extranjero o recién nacido"
                {...register('rutExemptReason')}
              />
              {errors.rutExemptReason && (
                <p className="form-error">{errors.rutExemptReason.message}</p>
              )}
            </div>
          )}
        </div>

        <PossiblePatientDuplicatesNotice
          nombre={nombre}
          fechaNacimiento={fechaNacimiento}
          rut={rut}
          rutExempt={rutExempt}
        />

        {isDoctor && (
          <NuevoPacienteDoctorFields
            register={register}
            errors={errors}
            todayDateValue={todayDateValue}
            fechaNacimiento={fechaNacimiento}
            edadCalculada={edadCalculada}
            onFechaNacimientoChange={(value) => setValue('fechaNacimiento', value, {
              shouldDirty: true,
              shouldValidate: true,
            })}
          />
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
    <ConfirmModal
      isOpen={Boolean(draftNavigationGuard.pendingNavigationHref)}
      onClose={draftNavigationGuard.clearPendingNavigation}
      onConfirm={() => {
        const href = draftNavigationGuard.pendingNavigationHref;
        draftNavigationGuard.clearPendingNavigation();
        if (href) router.push(href);
      }}
      title="Salir con datos sin guardar"
      message="Hay datos de paciente sin guardar. Se conservará un borrador cifrado en esta sesión para que puedas recuperarlo."
      confirmLabel="Salir"
      cancelLabel="Seguir editando"
      variant="warning"
    />
    </>
  );
}
