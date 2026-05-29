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
    <main className="portal-page">
      <section className="portal-container-narrow portal-card">
        <Link href="/portal" className="portal-link">Volver al portal</Link>
        <h1 className="portal-title mt-4">Solicitudes sobre tus datos</h1>
        <p className="portal-copy mt-2">Crea solicitudes de acceso, rectificación, oposición, portabilidad, supresión o bloqueo.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="portal-label">
            Tipo de solicitud
            <select value={requestType} onChange={(e) => setRequestType(e.target.value)} className="portal-input">
              {REQUEST_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="portal-label">
            RUT asociado
            <input value={requesterRut} onChange={(e) => setRequesterRut(e.target.value)} className="portal-input" />
          </label>
          <label className="portal-label">
            Detalle
            <textarea value={payloadRequest} onChange={(e) => setPayloadRequest(e.target.value)} rows={5} className="portal-input" />
          </label>
          {message && <div className="portal-alert-success">{message}</div>}
          {error && <div className="portal-alert-error">{error}</div>}
          <button className="portal-button-primary w-full">
            Enviar solicitud
          </button>
        </form>
      </section>
    </main>
  );
}
