'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
      <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
        <p className="font-semibold">Solicitud recibida</p>
        <p className="mt-2">
          Tu número de seguimiento es <code className="rounded bg-white px-1">{submitted.id}</code>.
        </p>
        <p className="mt-1">
          Plazo legal máximo de respuesta:{' '}
          <strong>{new Date(submitted.dueDate).toLocaleDateString('es-CL')}</strong>.
        </p>
        <p className="mt-2 text-xs text-teal-800">
          Recibirás un correo de acuse de recibo. Verificaremos tu identidad y
          responderemos dentro del plazo.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Nombre completo</label>
        <input
          {...register('requesterName')}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          autoComplete="name"
        />
        {errors.requesterName && (
          <p className="mt-1 text-xs text-rose-600">{errors.requesterName.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          RUT (opcional, ayuda a localizar tu ficha)
        </label>
        <input
          {...register('requesterRut')}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="12.345.678-9"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Email de contacto</label>
        <input
          {...register('requesterEmail')}
          type="email"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          autoComplete="email"
        />
        {errors.requesterEmail && (
          <p className="mt-1 text-xs text-rose-600">{errors.requesterEmail.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Tipo de solicitud</label>
        <select
          {...register('requestType')}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {REQUEST_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Describe tu solicitud</label>
        <textarea
          {...register('payloadRequest')}
          rows={5}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Indica si necesitas copia completa de tu ficha clínica, portabilidad u otro derecho específico."
        />
        {errors.payloadRequest && (
          <p className="mt-1 text-xs text-rose-600">{errors.payloadRequest.message}</p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" {...register('submittedAsRepresentative')} />
        Actúo como representante legal (padre, madre, tutor) del titular.
      </label>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {isSubmitting ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </form>
  );
}
