import {
  getDefaultInvitationTemplateHtml,
  INVITATION_TEMPLATE_PRESETS,
  INVITATION_TEMPLATE_TOKENS,
} from '@/lib/invitation-email-templates';
import type { AjustesHook } from './useAjustes';

type Props = Pick<
  AjustesHook,
  | 'clinic'
  | 'setClinic'
  | 'smtpPasswordConfigured'
  | 'clinicMutation'
  | 'testEmail'
  | 'setTestEmail'
  | 'testInvitationMutation'
  | 'currentPresetId'
  | 'invitationTemplatePreview'
  | 'invitationSubjectPreview'
  | 'previewBaseUrl'
>;

export default function EmailTab({
  clinic,
  setClinic,
  smtpPasswordConfigured,
  clinicMutation,
  testEmail,
  setTestEmail,
  testInvitationMutation,
  currentPresetId,
  invitationTemplatePreview,
  invitationSubjectPreview,
  previewBaseUrl,
}: Props) {
  return (
    <div role="tabpanel" id="tabpanel-correo" aria-labelledby="tab-correo">
      {/* SMTP settings */}
      <div className="card mb-6 border-accent/20">
        <div className="panel-header">
          <h2 className="panel-title">Correo SMTP para invitaciones</h2>
        </div>
        <p className="text-sm text-ink-muted mb-4">
          Se usa para enviar automáticamente las invitaciones creadas desde administración. Si queda incompleto, el
          sistema seguirá generando el enlace manual como respaldo.
        </p>
        <div className="mb-4 rounded-2xl border border-surface-muted/30 bg-surface-base/40 p-4 text-sm text-ink-secondary">
          <p className="font-medium text-ink-primary">Fallback por `.env`</p>
          <p className="mt-1">
            Si dejas campos vacíos aquí, el backend usa los valores definidos en `.env`: `APP_PUBLIC_URL`, `SMTP_HOST`,
            `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` e
            `INVITATION_EMAIL_SUBJECT`.
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="app-public-url" className="block text-sm font-medium text-ink-secondary mb-1">
              URL pública del frontend
            </label>
            <input
              id="app-public-url"
              type="url"
              className="input w-full"
              value={clinic.appPublicUrl}
              onChange={(e) => setClinic((c) => ({ ...c, appPublicUrl: e.target.value }))}
              placeholder="https://anamneo.tu-dominio.cl"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="smtp-host" className="block text-sm font-medium text-ink-secondary mb-1">
                Host SMTP
              </label>
              <input
                id="smtp-host"
                type="text"
                className="input w-full"
                value={clinic.smtpHost}
                onChange={(e) => setClinic((c) => ({ ...c, smtpHost: e.target.value }))}
                placeholder="smtp.tu-proveedor.com"
              />
            </div>
            <div>
              <label htmlFor="smtp-port" className="block text-sm font-medium text-ink-secondary mb-1">
                Puerto
              </label>
              <input
                id="smtp-port"
                type="number"
                className="input w-full"
                value={clinic.smtpPort}
                onChange={(e) => setClinic((c) => ({ ...c, smtpPort: e.target.value }))}
                placeholder="587"
              />
            </div>
          </div>
          <label htmlFor="smtp-secure" className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
            <input
              id="smtp-secure"
              type="checkbox"
              checked={clinic.smtpSecure}
              onChange={(e) => setClinic((c) => ({ ...c, smtpSecure: e.target.checked }))}
            />
            Usar conexión segura SSL/TLS
          </label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="smtp-user" className="block text-sm font-medium text-ink-secondary mb-1">
                Usuario SMTP
              </label>
              <input
                id="smtp-user"
                type="text"
                className="input w-full"
                value={clinic.smtpUser}
                onChange={(e) => setClinic((c) => ({ ...c, smtpUser: e.target.value }))}
                placeholder="usuario@tu-proveedor.com"
              />
            </div>
            <div>
              <label htmlFor="smtp-password" className="block text-sm font-medium text-ink-secondary mb-1">
                Clave SMTP
              </label>
              <input
                id="smtp-password"
                type="password"
                className="input w-full"
                value={clinic.smtpPassword}
                onChange={(e) => setClinic((c) => ({ ...c, smtpPassword: e.target.value }))}
                placeholder={smtpPasswordConfigured ? 'Configurada (dejar vacío para mantenerla)' : '••••••••'}
              />
              {smtpPasswordConfigured && !clinic.smtpPassword.trim() && (
                <p className="mt-2 text-xs text-ink-muted">
                  Ya existe una clave SMTP guardada. Este campo solo se usa para reemplazarla.
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="smtp-from-email" className="block text-sm font-medium text-ink-secondary mb-1">
                Remitente
              </label>
              <input
                id="smtp-from-email"
                type="email"
                className="input w-full"
                value={clinic.smtpFromEmail}
                onChange={(e) => setClinic((c) => ({ ...c, smtpFromEmail: e.target.value }))}
                placeholder="no-reply@tu-centro.cl"
              />
            </div>
            <div>
              <label htmlFor="smtp-from-name" className="block text-sm font-medium text-ink-secondary mb-1">
                Nombre remitente
              </label>
              <input
                id="smtp-from-name"
                type="text"
                className="input w-full"
                value={clinic.smtpFromName}
                onChange={(e) => setClinic((c) => ({ ...c, smtpFromName: e.target.value }))}
                placeholder="Anamneo"
              />
            </div>
          </div>
          <div>
            <label htmlFor="invitation-subject" className="block text-sm font-medium text-ink-secondary mb-1">
              Asunto del correo
            </label>
            <input
              id="invitation-subject"
              type="text"
              className="input w-full"
              value={clinic.invitationSubject}
              onChange={(e) => setClinic((c) => ({ ...c, invitationSubject: e.target.value }))}
              placeholder="Invitacion a {{clinicName}}"
            />
            <p className="mt-2 text-xs text-ink-muted">
              Vista previa: <strong>{invitationSubjectPreview}</strong>
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label htmlFor="smtp-test-email" className="block text-sm font-medium text-ink-secondary mb-1">
                Correo para prueba
              </label>
              <input
                id="smtp-test-email"
                type="email"
                className="input w-full"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="admin@tu-centro.cl"
              />
            </div>
            <button
              type="button"
              onClick={() => testInvitationMutation.mutate()}
              disabled={testInvitationMutation.isPending || !testEmail.trim()}
              className="btn btn-secondary"
            >
              {testInvitationMutation.isPending ? 'Enviando prueba...' : 'Enviar prueba'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => clinicMutation.mutate()}
            disabled={clinicMutation.isPending}
            className="btn btn-primary"
          >
            {clinicMutation.isPending ? 'Guardando...' : 'Guardar correo SMTP'}
          </button>
        </div>
      </div>

      {/* Invitation template editor */}
      <div className="card mb-6 border-accent/20">
        <div className="panel-header">
          <h2 className="panel-title">Plantillas de bienvenida HTML</h2>
        </div>
        <p className="text-sm text-ink-muted mb-4">
          Elige una base, ajusta el HTML y revisa la previsualizacion antes de guardar. Todas las opciones incluyen el
          logo institucional usando <strong>{'{{logoUrl}}'}</strong>.
        </p>

        <div className="grid gap-3 lg:grid-cols-3 mb-5">
          {INVITATION_TEMPLATE_PRESETS.map((preset) => {
            const isActive = currentPresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setClinic((current) => ({ ...current, invitationTemplateHtml: preset.html }))}
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
                onClick={() =>
                  setClinic((current) => ({
                    ...current,
                    invitationTemplateHtml: getDefaultInvitationTemplateHtml(),
                  }))
                }
              >
                Restaurar base
              </button>
            </div>
            <textarea
              className="input w-full min-h-[34rem] font-mono text-xs leading-6"
              value={clinic.invitationTemplateHtml}
              onChange={(e) => setClinic((current) => ({ ...current, invitationTemplateHtml: e.target.value }))}
              spellCheck={false}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-2">Previsualizador HTML</label>
            <div className="rounded-2xl border border-surface-muted/30 bg-surface-base/40 p-3">
              <iframe
                title="Previsualizacion plantilla bienvenida"
                srcDoc={invitationTemplatePreview}
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
            Se enviara en correos reales usando el logo de {previewBaseUrl}/anamneo-logo.svg.
          </p>
        </div>
      </div>
    </div>
  );
}
