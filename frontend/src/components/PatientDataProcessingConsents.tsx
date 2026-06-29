'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { notify } from '@/lib/notify';
import ConsentHistoryList from './patient-data-processing-consents/ConsentHistoryList';
import GrantConsentForm from './patient-data-processing-consents/GrantConsentForm';
import RevokeConsentModal from './patient-data-processing-consents/RevokeConsentModal';
import { MIN_REVOKE_REASON_LENGTH, REVOKE_CHANNELS } from './patient-data-processing-consents/constants';
import {
  DataProcessingConsent,
  GrantConsentFormState,
  LegalDocument,
  RevokeChannel,
} from './patient-data-processing-consents/types';

/**
 * Consentimiento del titular para el TRATAMIENTO DE DATOS PERSONALES
 * (Ley 21.719 Art 12). Separado del consentimiento clinico tipico
 * (PatientConsents.tsx), porque la base juridica y los actores son
 * distintos: aqui el otorgante es el TITULAR o su REPRESENTANTE LEGAL,
 * no el medico.
 *
 * Aplica adicionalmente Art 16 quater (NNA): cuando el paciente es
 * menor de 16 anos, signerRelationship debe ser PADRE/MADRE/TUTOR/REPRESENTANTE.
 * El backend valida esto y rechaza si signerRelationship=TITULAR.
 */

interface Props {
  patientId: string;
  patientAgeYears?: number | null;
}

const initialForm: GrantConsentFormState = {
  legalDocumentId: '',
  purpose: 'ATENCION_CLINICA',
  method: 'PRESENCIAL_TABLET',
  signerName: '',
  signerRut: '',
  signerRelationship: 'TITULAR',
};

export default function PatientDataProcessingConsents({ patientId, patientAgeYears }: Props) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [revokeConsent, setRevokeConsent] = useState<DataProcessingConsent | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeChannel, setRevokeChannel] = useState<RevokeChannel>(REVOKE_CHANNELS[0].value);
  const [form, setForm] = useState<GrantConsentFormState>(initialForm);

  const isMinor16 = patientAgeYears != null && patientAgeYears < 16;
  const isMinor14 = patientAgeYears != null && patientAgeYears < 14;
  const queryKey = ['patient-data-processing-consents', patientId] as const;

  const { data: consents = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await api.get<DataProcessingConsent[]>(`/patient-consents/patient/${patientId}`);
      return res.data;
    },
  });

  const { data: activeLegal } = useQuery({
    queryKey: ['active-privacy-policy'],
    queryFn: async () => {
      const res = await api.get<LegalDocument & { contentJson: unknown }>('/legal/published/PRIVACY');
      if (res.data && form.legalDocumentId === '') {
        setForm((current) => ({ ...current, legalDocumentId: res.data.id }));
      }
      return res.data;
    },
  });

  const grantMutation = useMutation({
    mutationFn: async () => api.post('/patient-consents/grant', {
      patientId,
      legalDocumentId: form.legalDocumentId,
      purpose: form.purpose,
      method: form.method,
      signerName: form.signerName.trim(),
      signerRut: form.signerRut.trim() || undefined,
      signerRelationship: form.signerRelationship,
    }),
    onSuccess: () => {
      notify.success('Consentimiento registrado');
      queryClient.invalidateQueries({ queryKey });
      setShowForm(false);
      setForm((current) => ({
        ...current,
        signerName: '',
        signerRut: '',
        signerRelationship: isMinor16 ? 'PADRE' : 'TITULAR',
      }));
    },
    onError: (err) => notify.error(getErrorMessage(err)),
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      if (!revokeConsent) return;
      return api.post(`/patient-consents/${revokeConsent.id}/revoke`, {
        reason: revokeReason.trim(),
        channel: revokeChannel,
      });
    },
    onSuccess: () => {
      notify.success('Consentimiento revocado');
      queryClient.invalidateQueries({ queryKey });
      setRevokeConsent(null);
      setRevokeReason('');
    },
    onError: (err) => notify.error(getErrorMessage(err)),
  });

  const handleShowForm = () => {
    setShowForm(true);
    if (isMinor16) {
      setForm((current) => ({ ...current, signerRelationship: 'PADRE' }));
    }
  };

  const handleSubmitGrant = () => {
    if (!form.legalDocumentId || !form.signerName.trim()) {
      notify.error('Selecciona política y nombre del firmante');
      return;
    }
    grantMutation.mutate();
  };

  const handleCloseRevoke = () => {
    if (revokeMutation.isPending) return;
    setRevokeConsent(null);
    setRevokeReason('');
  };

  const handleConfirmRevoke = () => {
    if (revokeReason.trim().length < MIN_REVOKE_REASON_LENGTH) {
      notify.error(`El motivo debe tener al menos ${MIN_REVOKE_REASON_LENGTH} caracteres`);
      return;
    }
    revokeMutation.mutate();
  };

  return (
    <section className="rounded-card border border-surface-muted/30 bg-surface-elevated p-6">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Ley 21.719 — Art 12
          </p>
          <h2 className="text-lg font-semibold text-ink-primary">
            Consentimiento del titular para tratamiento de datos personales
          </h2>
          <p className="mt-1 text-xs text-ink-secondary">
            Distinto del consentimiento clínico (procedimientos, intervenciones).
            Este consentimiento autoriza el tratamiento de los datos personales
            bajo la política de privacidad vigente.
          </p>
        </div>
        {!showForm && (
          <button type="button" onClick={handleShowForm} className="btn btn-primary text-sm">
            + Capturar consentimiento
          </button>
        )}
      </header>

      {isMinor16 && (
        <div className="mb-4 rounded-card border border-status-yellow/65 bg-status-yellow/20 p-3 text-xs text-accent-text">
          ⚠ Paciente menor de 16 años. El consentimiento sobre datos sensibles
          debe ser otorgado por <strong>padre, madre, tutor o representante legal</strong>.
          {isMinor14 && ' Para menores de 14 años esto aplica también a datos no sensibles.'}
        </div>
      )}

      {showForm && (
        <GrantConsentForm
          activeLegal={activeLegal}
          form={form}
          isMinor16={isMinor16}
          isPending={grantMutation.isPending}
          onCancel={() => setShowForm(false)}
          onChange={setForm}
          onSubmit={handleSubmitGrant}
        />
      )}

      <ConsentHistoryList
        consents={consents}
        isLoading={isLoading}
        onRevoke={setRevokeConsent}
      />

      {revokeConsent && (
        <RevokeConsentModal
          consent={revokeConsent}
          isPending={revokeMutation.isPending}
          reason={revokeReason}
          channel={revokeChannel}
          onCancel={handleCloseRevoke}
          onChannelChange={setRevokeChannel}
          onConfirm={handleConfirmRevoke}
          onReasonChange={setRevokeReason}
        />
      )}
    </section>
  );
}
