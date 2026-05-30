'use client';

import { useEffect, useRef, useState } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { notify } from '@/lib/notify';
import { type DataRequest, type PendingDecision, getExportDelivery } from './solicitudes.types';

export function useSolicitudes() {
  const [items, setItems] = useState<DataRequest[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DataRequest | null>(null);
  const [patientId, setPatientId] = useState('');
  const [identityVerificationMethod, setIdentityVerificationMethod] = useState('PRESENCIAL');
  const [identityEvidence, setIdentityEvidence] = useState('');
  const [exportLink, setExportLink] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const decisionCancelRef = useRef<HTMLButtonElement>(null);
  const selectedCloseRef = useRef<HTMLButtonElement>(null);

  const selectedExportDelivery = selected ? getExportDelivery(selected.payloadResponse) : null;

  const load = async (filterStatus?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<DataRequest[]>('/admin/data-requests', {
        params: filterStatus ? { status: filterStatus } : {},
      });
      setItems(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(status);
  }, [status]);

  const openDecision = (decision: PendingDecision) => {
    setPendingDecision(decision);
    setDecisionNote('');
    setDecisionError(null);
  };

  const handleMarkInReview = async (id: string) => {
    try {
      await api.patch(`/admin/data-requests/${id}`, { status: 'EN_REVISION' });
      await load(status);
    } catch (err) {
      notify.error(getErrorMessage(err));
    }
  };

  const handleSaveVerification = async () => {
    if (!selected) return;
    if (!patientId.trim()) {
      notify.error('Ingresa el ID del paciente antes de guardar la verificación.');
      return;
    }
    try {
      const res = await api.patch<DataRequest>(`/admin/data-requests/${selected.id}`, {
        patientId: patientId.trim(),
        identityVerificationMethod,
        identityVerificationEvidence: {
          note: identityEvidence.trim() || null,
          recordedAt: new Date().toISOString(),
        },
        status: selected.status === 'RECIBIDA' ? 'EN_REVISION' : undefined,
      });
      setSelected(res.data);
      await load(status);
    } catch (err) {
      notify.error(getErrorMessage(err));
    }
  };

  const handleGenerateExportLink = async () => {
    if (!selected) return;
    try {
      const res = await api.post<{
        id: string;
        downloadUrl: string;
        expiresAt: string;
        maxDownloads: number;
        mail: { sent: boolean; reason: string | null };
      }>(`/admin/data-requests/${selected.id}/export-link`, {});
      setExportLink(res.data.downloadUrl);
      setSelected({
        ...selected,
        payloadResponse: {
          exportDelivery: {
            downloadId: res.data.id,
            expiresAt: res.data.expiresAt,
            maxDownloads: res.data.maxDownloads,
          },
        },
      });
      await load(status);
      if (!res.data.mail.sent) {
        notify.info(`Enlace generado, pero no se pudo enviar correo: ${res.data.mail.reason ?? 'SMTP no configurado'}`);
      }
    } catch (err) {
      notify.error(getErrorMessage(err));
    }
  };

  const handleSubmitDecision = async () => {
    if (!selected || !pendingDecision) return;
    const note = decisionNote.trim();
    if (note.length < pendingDecision.minLength) {
      setDecisionError(`Ingresa al menos ${pendingDecision.minLength} caracteres para auditar la decisión.`);
      return;
    }
    setDecisionSubmitting(true);
    setDecisionError(null);
    try {
      if (pendingDecision.kind === 'resolve-accept' || pendingDecision.kind === 'resolve-reject') {
        await api.post(`/admin/data-requests/${selected.id}/resolve`, {
          status: pendingDecision.kind === 'resolve-accept' ? 'RESUELTA_ACEPTADA' : 'RESUELTA_RECHAZADA',
          resolutionNote: note,
        });
        setSelected(null);
      }
      if (pendingDecision.kind === 'extend') {
        await api.post(`/admin/data-requests/${selected.id}/extend`, { reason: note });
      }
      if (pendingDecision.kind === 'revoke' && pendingDecision.downloadId) {
        await api.post(`/admin/data-request-downloads/${pendingDecision.downloadId}/revoke`, { reason: note });
        setExportLink(null);
        notify.success('Enlace revocado');
      }
      setPendingDecision(null);
      setDecisionNote('');
      await load(status);
    } catch (err) {
      setDecisionError(getErrorMessage(err));
    } finally {
      setDecisionSubmitting(false);
    }
  };

  return {
    items,
    status,
    setStatus,
    loading,
    error,
    selected,
    setSelected,
    patientId,
    setPatientId,
    identityVerificationMethod,
    setIdentityVerificationMethod,
    identityEvidence,
    setIdentityEvidence,
    exportLink,
    pendingDecision,
    setPendingDecision,
    decisionNote,
    setDecisionNote,
    decisionError,
    decisionSubmitting,
    decisionCancelRef,
    selectedCloseRef,
    selectedExportDelivery,
    openDecision,
    handleMarkInReview,
    handleSaveVerification,
    handleGenerateExportLink,
    handleSubmitDecision,
  };
}
