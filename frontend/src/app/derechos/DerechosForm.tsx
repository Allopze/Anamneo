'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertBanner } from '@/components/common/AlertBanner';
import { api, getErrorMessage } from '@/lib/api';

const REQUEST_TYPES = [
  { value: 'ACCESO', label: 'Acceso (copia de mi ficha clínica)' },
  { value: 'RECTIFICACION', label: 'Rectificación (corregir datos inexactos)' },
  { value: 'SUPRESION', label: 'Supresión (eliminar mis datos)' },
  { value: 'OPOSICION', label: 'Oposición a un tratamiento' },
  { value: 'PORTABILIDAD', label: 'Portabilidad (entrega en formato estructurado)' },
  { value: 'BLOQUEO', label: 'Bloqueo temporal del tratamiento' },
] as const;

const schema = z.object({
  requesterName: z.string().trim().min(2, 'Nombre obligatorio'),
  requesterRut: z.string().trim().optional(),
  requesterEmail: z.string().trim().toLowerCase().email('Email inválido'),
  requestType: z.enum([
    'ACCESO',
    'RECTIFICACION',
    'SUPRESION',
    'OPOSICION',
    'PORTABILIDAD',
    'BLOQUEO',
  ]),
  payloadRequest: z.string().trim().min(10, 'Describe brevemente tu solicitud (mín. 10 caracteres)'),
  submittedAsRepresentative: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

export function DerechosForm() {
  const [submitted, setSubmitted] = useState<{ id: string; dueDate: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { requestType: 'ACCESO' },
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      const res = await api.post<{ id: string; dueDate: string; status: string }>(
        '/public/derechos',
        {
          requesterName: values.requesterName,
          requesterRut: values.requesterRut?.trim() || undefined,
          requesterEmail: values.requesterEmail,
          requestType: values.requestType,
          payloadRequest: values.payloadRequest,
          submittedBy: values.submittedAsRepresentative ? 'REPRESENTANTE' : undefined,
        },
      );
      setSubmitted({ id: res.data.id, dueDate: res.data.dueDate });
      reset();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (submitted) {
    return (
      <AlertBanner
        variant="success"
        title="Solicitud recibida"
        message={(
          <>
            <p>
              Tu número de seguimiento es <code className="rounded bg-surface-elevated px-1">{submitted.id}</code>.
            </p>
            <p className="mt-1">
              Plazo legal máximo de respuesta:{' '}
              <strong>{new Date(submitted.dueDate).toLocaleDateString('es-CL')}</strong>.
            </p>
            <p className="mt-2 text-xs leading-5">
              Recibirás un correo de acuse de recibo. Verificaremos tu identidad y responderemos dentro del plazo.
            </p>
          </>
        )}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="form-label">Nombre completo</label>
        <input
          {...register('requesterName')}
          className="form-input mt-1"
          autoComplete="name"
        />
        {errors.requesterName && (
          <p className="form-error">{errors.requesterName.message}</p>
        )}
      </div>

      <div>
        <label className="form-label">
          RUT (opcional, ayuda a localizar tu ficha)
        </label>
        <input
          {...register('requesterRut')}
          className="form-input mt-1"
          placeholder="12.345.678-9"
        />
      </div>

      <div>
        <label className="form-label">Email de contacto</label>
        <input
          {...register('requesterEmail')}
          type="email"
          className="form-input mt-1"
          autoComplete="email"
        />
        {errors.requesterEmail && (
          <p className="form-error">{errors.requesterEmail.message}</p>
        )}
      </div>

      <div>
        <label className="form-label">Tipo de solicitud</label>
        <select
          {...register('requestType')}
          className="form-input mt-1"
        >
          {REQUEST_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="form-label">Describe tu solicitud</label>
        <textarea
          {...register('payloadRequest')}
          rows={5}
          className="form-textarea form-input mt-1"
          placeholder="Indica si necesitas copia completa de tu ficha clínica, portabilidad u otro derecho específico."
        />
        {errors.payloadRequest && (
          <p className="form-error">{errors.payloadRequest.message}</p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-secondary">
        <input type="checkbox" {...register('submittedAsRepresentative')} />
        Actúo como representante legal (padre, madre, tutor) del titular.
      </label>

      {error && (
        <AlertBanner variant="error" message={error} />
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn btn-primary w-full"
      >
        {isSubmitting ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </form>
  );
}
