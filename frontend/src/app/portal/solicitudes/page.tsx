'use client';

import { useState } from 'react';
import DataRightsRequestShell from '@/components/legal/DataRightsRequestShell';
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
    <DataRightsRequestShell
      backHref="/portal"
      backLabel="Volver al portal"
      eyebrow="Portal paciente"
      title="Solicitudes sobre tus datos"
      description="Crea solicitudes de acceso, rectificación, oposición, portabilidad, supresión o bloqueo desde tu sesión verificada."
      helper="Al estar autenticado, tu solicitud queda asociada a tu ficha portal. Puedes agregar un RUT si necesitas relacionarla con otro identificador."
      footer="Estas solicitudes quedan registradas para trazabilidad y revisión del equipo administrativo."
    >
        <header className="mb-6 border-b border-surface-muted/70 pb-4">
          <h2 className="portal-title-sm">Crear solicitud portal</h2>
          <p className="portal-copy mt-2">Describe con claridad qué dato o documento necesitas revisar.</p>
        </header>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <textarea value={payloadRequest} onChange={(e) => setPayloadRequest(e.target.value)} rows={5} className="portal-input portal-textarea" />
          </label>
          {message && <div className="portal-alert-success">{message}</div>}
          {error && <div className="portal-alert-error">{error}</div>}
          <button className="portal-button-primary w-full">
            Enviar solicitud
          </button>
        </form>
    </DataRightsRequestShell>
  );
}
