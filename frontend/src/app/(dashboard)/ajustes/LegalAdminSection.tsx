'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiEdit3, FiFileText, FiSend } from 'react-icons/fi';
import { notify } from '@/lib/notify';
import { api, getErrorMessage } from '@/lib/api';
import {
  LEGAL_DOCUMENT_LABELS,
  type LegalDocumentContentJson,
  type LegalDocumentPublic,
  type LegalDocumentType,
} from '@/lib/legal-content';

type LegalAdminResponse = {
  documents: LegalDocumentPublic[];
};

const DOCUMENT_TYPES: LegalDocumentType[] = ['TERMS', 'PRIVACY'];

function buildStarterContent(type: LegalDocumentType): LegalDocumentContentJson {
  return {
    summary: [`Resumen editable para ${LEGAL_DOCUMENT_LABELS[type]}.`],
    sections: [
      {
        id: 'alcance',
        title: 'Alcance',
        body: ['Describe aquí el alcance, responsabilidades y condiciones aplicables.'],
      },
    ],
    contactEmail: 'soporte@anamneo.cl',
    references: [],
    footerNote: 'Documento publicado por el administrador del espacio clínico.',
  };
}

function toDateInputValue(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return parsed.toISOString().slice(0, 10);
}

export default function LegalAdminSection() {
  const queryClient = useQueryClient();
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('');
  const [effectiveAt, setEffectiveAt] = useState('');
  const [contentJsonText, setContentJsonText] = useState('');

  const documentsQuery = useQuery({
    queryKey: ['legal-admin-documents'],
    queryFn: async () => {
      const response = await api.get('/legal/admin/documents');
      return response.data as LegalAdminResponse;
    },
  });

  const groupedDocuments = useMemo(() => {
    return DOCUMENT_TYPES.reduce((acc, type) => {
      const documents = documentsQuery.data?.documents.filter((document) => document.type === type) ?? [];
      acc[type] = {
        published: documents.find((document) => document.status === 'PUBLISHED') ?? null,
        draft: documents.find((document) => document.status === 'DRAFT') ?? null,
        archivedCount: documents.filter((document) => document.status === 'ARCHIVED').length,
      };
      return acc;
    }, {} as Record<LegalDocumentType, { published: LegalDocumentPublic | null; draft: LegalDocumentPublic | null; archivedCount: number }>);
  }, [documentsQuery.data]);

  const selectedDraft = documentsQuery.data?.documents.find((document) => document.id === selectedDraftId) ?? null;

  useEffect(() => {
    if (!selectedDraft) {
      return;
    }

    setTitle(selectedDraft.title);
    setDescription(selectedDraft.description);
    setVersion(selectedDraft.version);
    setEffectiveAt(toDateInputValue(selectedDraft.effectiveAt));
    setContentJsonText(JSON.stringify(selectedDraft.contentJson, null, 2));
  }, [selectedDraft]);

  const refreshLegalQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['legal-admin-documents'] }),
      queryClient.invalidateQueries({ queryKey: ['legal-documents', 'current'] }),
      queryClient.invalidateQueries({ queryKey: ['legal-acceptances', 'me'] }),
    ]);
  };

  const createDraftMutation = useMutation({
    mutationFn: async (type: LegalDocumentType) => {
      const published = groupedDocuments[type].published;
      const response = await api.post('/legal/admin/documents/draft', {
        type,
        sourceDocumentId: published?.id,
        ...(!published
          ? {
              title: LEGAL_DOCUMENT_LABELS[type],
              description: '',
              contentJson: buildStarterContent(type),
            }
          : {}),
      });
      return response.data as LegalDocumentPublic;
    },
    onSuccess: async (document) => {
      setSelectedDraftId(document.id);
      await refreshLegalQueries();
      notify.success('Borrador legal creado.');
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDraft) {
        throw new Error('Selecciona un borrador para guardar.');
      }

      const parsedContent = JSON.parse(contentJsonText) as LegalDocumentContentJson;
      const response = await api.patch(`/legal/admin/documents/${selectedDraft.id}`, {
        title,
        description,
        version,
        effectiveAt: `${effectiveAt}T00:00:00.000Z`,
        contentJson: parsedContent,
      });

      return response.data as LegalDocumentPublic;
    },
    onSuccess: async (document) => {
      setSelectedDraftId(document.id);
      await refreshLegalQueries();
      notify.success('Borrador legal guardado.');
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDraft) {
        throw new Error('Selecciona un borrador para publicar.');
      }

      const response = await api.post(`/legal/admin/documents/${selectedDraft.id}/publish`);
      return response.data as LegalDocumentPublic;
    },
    onSuccess: async (document) => {
      setSelectedDraftId(null);
      await refreshLegalQueries();
      notify.success(`${document.title} publicado.`);
    },
    onError: (error) => notify.error(getErrorMessage(error)),
  });

  const handleSave = () => {
    try {
      JSON.parse(contentJsonText);
    } catch {
      notify.error('El contenido JSON no es válido.');
      return;
    }

    saveDraftMutation.mutate();
  };

  const handlePublish = () => {
    if (!window.confirm('Publicar este borrador archivará la versión vigente del mismo tipo.')) {
      return;
    }

    publishMutation.mutate();
  };

  return (
    <section className="rounded-2xl border border-surface-muted/40 bg-surface-elevated p-4 text-sm text-ink-secondary">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium text-ink-primary">Documentos legales editables</p>
          <p className="mt-1 text-xs text-ink-muted">
            Administra borradores, versiones publicadas y el texto que ven registro, términos y privacidad.
          </p>
        </div>
        <span className="rounded-full bg-surface-inset px-3 py-1 text-xs font-medium text-ink-secondary">
          Admin
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {DOCUMENT_TYPES.map((type) => {
          const state = groupedDocuments[type];
          return (
            <div key={type} className="rounded-xl border border-surface-muted/30 bg-white/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink-primary">{LEGAL_DOCUMENT_LABELS[type]}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Vigente: {state.published?.version ?? 'sin publicación'} · Archivadas: {state.archivedCount}
                  </p>
                </div>
                <FiFileText className="h-5 w-5 text-ink-muted" aria-hidden="true" />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-secondary gap-2"
                  disabled={createDraftMutation.isPending || Boolean(state.draft)}
                  onClick={() => createDraftMutation.mutate(type)}
                >
                  <FiEdit3 className="h-4 w-4" aria-hidden="true" />
                  {state.draft ? 'Borrador creado' : 'Crear borrador'}
                </button>
                {state.draft ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setSelectedDraftId(state.draft?.id ?? null)}
                  >
                    Editar borrador
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {documentsQuery.isLoading ? (
        <div className="mt-4 h-20 skeleton rounded-xl" />
      ) : null}

      {selectedDraft ? (
        <div className="mt-4 rounded-xl border border-surface-muted/30 bg-surface-inset/60 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="legal-title" className="form-label">Título</label>
              <input id="legal-title" className="form-input" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div>
              <label htmlFor="legal-version" className="form-label">Versión</label>
              <input id="legal-version" className="form-input" value={version} onChange={(event) => setVersion(event.target.value)} />
            </div>
            <div>
              <label htmlFor="legal-effective-at" className="form-label">Fecha de vigencia</label>
              <input id="legal-effective-at" type="date" className="form-input" value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} />
            </div>
            <div>
              <label htmlFor="legal-description" className="form-label">Descripción</label>
              <input id="legal-description" className="form-input" value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
          </div>

          <div className="mt-3">
            <label htmlFor="legal-content-json" className="form-label">Contenido JSON</label>
            <textarea
              id="legal-content-json"
              className="form-input min-h-[280px] font-mono text-xs"
              value={contentJsonText}
              onChange={(event) => setContentJsonText(event.target.value)}
              spellCheck={false}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={saveDraftMutation.isPending}
              onClick={handleSave}
            >
              {saveDraftMutation.isPending ? 'Guardando…' : 'Guardar borrador'}
            </button>
            <button
              type="button"
              className="btn btn-accent gap-2"
              disabled={publishMutation.isPending || saveDraftMutation.isPending}
              onClick={handlePublish}
            >
              <FiSend className="h-4 w-4" aria-hidden="true" />
              {publishMutation.isPending ? 'Publicando…' : 'Publicar versión'}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-surface-muted/30 bg-surface-inset/60 px-4 py-3 text-xs text-ink-muted">
          Crea o selecciona un borrador para modificar el texto legal sin tocar código.
        </p>
      )}
    </section>
  );
}
