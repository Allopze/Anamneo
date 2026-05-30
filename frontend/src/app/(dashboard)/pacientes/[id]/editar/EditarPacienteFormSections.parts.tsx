'use client';

/**
 * Form section sub-components for EditarPacienteFormSections.tsx.
 */

import clsx from 'clsx';
import type { UseFormReturn } from 'react-hook-form';
import { todayLocalDateString } from '@/lib/date';
import { formatRut } from '@/lib/rut';
import type { EditForm } from './editar.constants';

type EditFormReturn = UseFormReturn<EditForm>;

// ── Identificación ───────────────────────────────────────────────

interface IdentificacionSectionProps {
  editForm: EditFormReturn;
  rutExempt: boolean;
  isDoctor: boolean;
}

export function IdentificacionSection({
  editForm,
  rutExempt,
  isDoctor,
}: IdentificacionSectionProps) {
  if (!isDoctor) return null;

  return (
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
        {editForm.formState.errors.nombre ? (
          <p className="form-error">{String(editForm.formState.errors.nombre.message || '')}</p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <label htmlFor="rut" className="form-label">RUT</label>
          <input
            id="rut"
            className={clsx('form-input', editForm.formState.errors.rut && 'form-input-error')}
            disabled={rutExempt}
            placeholder="Ej: 12.345.678-9"
            autoComplete="off"
            spellCheck={false}
            {...editForm.register('rut', {
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                const raw = e.target.value;
                const cleaned = raw.replace(/[.\-\s]/g, '');
                if (cleaned.length >= 2) {
                  e.target.value = formatRut(raw);
                }
              },
            })}
          />
          {editForm.formState.errors.rut ? (
            <p className="form-error">{String(editForm.formState.errors.rut.message || '')}</p>
          ) : null}
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

      {rutExempt ? (
        <div className="section-callout section-callout-subtle">
          <label htmlFor="rutExemptReason" className="form-label">Motivo de exención</label>
          <input
            id="rutExemptReason"
            className={clsx('form-input', editForm.formState.errors.rutExemptReason && 'form-input-error')}
            placeholder="Ej: extranjero o recién nacido"
            autoComplete="off"
            {...editForm.register('rutExemptReason')}
          />
          {editForm.formState.errors.rutExemptReason ? (
            <p className="form-error">{String(editForm.formState.errors.rutExemptReason.message || '')}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

// ── Datos demográficos ───────────────────────────────────────────

interface DemograficosSectionProps {
  editForm: EditFormReturn;
  edadCalculada: { edad: number; edadMeses: number } | null;
}

export function DemograficosSection({ editForm, edadCalculada }: DemograficosSectionProps) {
  return (
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
          {editForm.formState.errors.fechaNacimiento ? (
            <p className="form-error">{String(editForm.formState.errors.fechaNacimiento.message || '')}</p>
          ) : null}
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
            {...editForm.register('sexo', { setValueAs: (v) => (v === '' ? null : v) })}
          >
            <option value="">Sin definir</option>
            <option value="MASCULINO">Masculino</option>
            <option value="FEMENINO">Femenino</option>
            <option value="OTRO">Otro</option>
            <option value="PREFIERE_NO_DECIR">Prefiere no decir</option>
          </select>
          {editForm.formState.errors.sexo ? (
            <p className="form-error">{editForm.formState.errors.sexo.message}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="prevision" className="form-label">Previsión</label>
          <select
            id="prevision"
            className={clsx('form-input', editForm.formState.errors.prevision && 'form-input-error')}
            {...editForm.register('prevision', { setValueAs: (v) => (v === '' ? null : v) })}
          >
            <option value="">Sin definir</option>
            <option value="FONASA">FONASA</option>
            <option value="ISAPRE">ISAPRE</option>
            <option value="OTRA">Otra</option>
            <option value="DESCONOCIDA">Desconocida</option>
          </select>
          {editForm.formState.errors.prevision ? (
            <p className="form-error">{editForm.formState.errors.prevision.message}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ── Contexto administrativo ──────────────────────────────────────

interface ContextoAdministrativoSectionProps {
  editForm: EditFormReturn;
}

export function ContextoAdministrativoSection({ editForm }: ContextoAdministrativoSectionProps) {
  return (
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="telefono" className="form-label">Teléfono</label>
          <input
            id="telefono"
            type="tel"
            autoComplete="tel"
            className={clsx('form-input', editForm.formState.errors.telefono && 'form-input-error')}
            {...editForm.register('telefono')}
          />
          {editForm.formState.errors.telefono ? (
            <p className="form-error">{String(editForm.formState.errors.telefono.message || '')}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="email" className="form-label">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={clsx('form-input', editForm.formState.errors.email && 'form-input-error')}
            {...editForm.register('email')}
          />
          {editForm.formState.errors.email ? (
            <p className="form-error">{String(editForm.formState.errors.email.message || '')}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="contactoEmergenciaNombre" className="form-label">Contacto de emergencia</label>
          <input
            id="contactoEmergenciaNombre"
            className={clsx('form-input', editForm.formState.errors.contactoEmergenciaNombre && 'form-input-error')}
            {...editForm.register('contactoEmergenciaNombre')}
          />
          {editForm.formState.errors.contactoEmergenciaNombre ? (
            <p className="form-error">{String(editForm.formState.errors.contactoEmergenciaNombre.message || '')}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="contactoEmergenciaTelefono" className="form-label">Teléfono de emergencia</label>
          <input
            id="contactoEmergenciaTelefono"
            type="tel"
            className={clsx('form-input', editForm.formState.errors.contactoEmergenciaTelefono && 'form-input-error')}
            {...editForm.register('contactoEmergenciaTelefono')}
          />
          {editForm.formState.errors.contactoEmergenciaTelefono ? (
            <p className="form-error">{String(editForm.formState.errors.contactoEmergenciaTelefono.message || '')}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
