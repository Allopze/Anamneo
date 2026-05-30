'use client';

/**
 * Sub-components for EmailTab.tsx.
 */

import {
  getDefaultInvitationTemplateHtml,
  INVITATION_TEMPLATE_PRESETS,
  INVITATION_TEMPLATE_TOKENS,
} from '@/lib/invitation-email-templates';
import type { AjustesHook } from './useAjustes';

interface InvitationTemplateEditorProps {
  htmlValue: string;
  currentPresetId: string | null;
  invitationTemplatePreview: string | null;
  previewBaseUrl: string | null;
  clinicMutation: AjustesHook['clinicMutation'];
  onHtmlChange: (html: string) => void;
}

export function InvitationTemplateEditor({
  htmlValue,
  currentPresetId,
  invitationTemplatePreview,
  previewBaseUrl,
  clinicMutation,
  onHtmlChange,
}: InvitationTemplateEditorProps) {
  return (
    <div className="card mb-6 border-accent/20">
      <div className="panel-header">
        <h2 className="panel-title">Plantillas de bienvenida HTML</h2>
      </div>
      <p className="text-sm text-ink-muted mb-4">
        Elige una base, ajusta el HTML y revisa la previsualizacion antes de guardar. Todas las
        opciones incluyen el logo institucional usando <strong>{'{{logoUrl}}'}</strong>.
      </p>

      <div className="grid gap-3 lg:grid-cols-3 mb-5">
        {INVITATION_TEMPLATE_PRESETS.map((preset) => {
          const isActive = currentPresetId != null && currentPresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onHtmlChange(preset.html)}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                isActive
                  ? 'border-accent/80 bg-accent/10'
                  : 'border-surface-muted/30 bg-surface-elevated hover:border-accent/60'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink-primary">{preset.name}</h3>
                {isActive && <span className="text-xs font-medium text-accent-text">Activa</span>}
              </div>
              <p className="mt-2 text-sm text-ink-secondary">{preset.description}</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-surface-muted/30 bg-surface-base/40 p-4 mb-5">
        <p className="text-sm font-medium text-ink-primary">Placeholders disponibles</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {INVITATION_TEMPLATE_TOKENS.map((token) => (
            <span
              key={token}
              className="rounded-full border border-surface-muted/30 bg-surface-elevated px-3 py-1 text-xs text-ink-secondary"
            >
              {token}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <label className="block text-sm font-medium text-ink-secondary">Editor HTML</label>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onHtmlChange(getDefaultInvitationTemplateHtml())}
            >
              Restaurar base
            </button>
          </div>
          <textarea
            className="form-input w-full h-[34rem] min-h-[34rem] font-mono text-xs leading-6"
            value={htmlValue}
            onChange={(e) => onHtmlChange(e.target.value)}
            spellCheck={false}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-secondary mb-2">
            Previsualizador HTML
          </label>
          <div className="rounded-2xl border border-surface-muted/30 bg-surface-base/40 p-3">
            <iframe
              title="Previsualizacion plantilla bienvenida"
              srcDoc={invitationTemplatePreview ?? ''}
              sandbox=""
              className="h-[34rem] w-full rounded-xl border border-surface-muted/30 bg-surface-elevated"
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => clinicMutation.mutate()}
          disabled={clinicMutation.isPending}
          className="btn btn-primary"
        >
          {clinicMutation.isPending ? 'Guardando...' : 'Guardar plantilla de bienvenida'}
        </button>
        <p className="text-xs text-ink-muted">
          Se enviara en correos reales usando el logo de {previewBaseUrl ?? ''}/anamneo-logo.svg.
        </p>
      </div>
    </div>
  );
}
