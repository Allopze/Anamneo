'use client';

import Link from 'next/link';
import { useState } from 'react';
import { portalApi, getErrorMessage } from '@/lib/portal-api';

const REQUEST_TYPES = [
  { value: 'ACCESO', label: 'Acceso a copia de ficha clínica' },
  { value: 'RECTIFICACION', label: 'Rectificación' },
  { value: 'SUPRESION', label: 'Supresión' },
  { value: 'OPOSICION', label: 'Oposición' },
  { value: 'PORTABILIDAD', label: 'Portabilidad' },
  { value: 'BLOQUEO', label: 'Bloqueo temporal' },
];

export default function PortalSolicitudesPage() {
  const [requestType, setRequestType] = useState('ACCESO');
  const [payloadRequest, setPayloadRequest] = useState('');
  const [requesterRut, setRequesterRut] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const res = await portalApi.post('/portal/data-requests', {
        requestType,
        payloadRequest,
        requesterRut: requesterRut || undefined,
      });
      setMessage(`Solicitud recibida. Número: ${res.data.id}`);
      setPayloadRequest('');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <section className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-6">
        <Link href="/portal" className="text-sm text-teal-700 underline">Volver al portal</Link>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Solicitudes sobre tus datos</h1>
        <p className="mt-2 text-sm text-slate-600">Crea solicitudes de acceso, rectificación, oposición, portabilidad, supresión o bloqueo.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm text-slate-700">
            Tipo de solicitud
            <select value={requestType} onChange={(e) => setRequestType(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm">
              {REQUEST_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="block text-sm text-slate-700">
            RUT asociado
            <input value={requesterRut} onChange={(e) => setRequesterRut(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm text-slate-700">
            Detalle
            <textarea value={payloadRequest} onChange={(e) => setPayloadRequest(e.target.value)} rows={5} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </label>
          {message && <div className="rounded border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">{message}</div>}
          {error && <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
          <button className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">
            Enviar solicitud
          </button>
        </form>
      </section>
    </main>
  );
}
