'use client';

import clsx from 'clsx';
import type { UseFormReturn } from 'react-hook-form';
import type { EditForm } from './editar.constants';

interface ContextoAdministrativoSectionProps {
  editForm: UseFormReturn<EditForm>;
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
          <input id="trabajo" autoComplete="organization-title" className="form-input" {...editForm.register('trabajo')} />
        </div>

        <div>
          <label htmlFor="centroMedico" className="form-label">Centro médico</label>
          <input id="centroMedico" autoComplete="organization" className="form-input" {...editForm.register('centroMedico')} />
        </div>
      </div>

      <div>
        <label htmlFor="domicilio" className="form-label">Domicilio</label>
        <input id="domicilio" autoComplete="street-address" className="form-input" {...editForm.register('domicilio')} />
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
