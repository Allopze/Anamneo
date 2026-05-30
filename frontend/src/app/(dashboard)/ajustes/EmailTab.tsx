import type { AjustesHook } from './useAjustes';
import { InvitationTemplateEditor } from './EmailTab.parts';

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

      <InvitationTemplateEditor
        htmlValue={clinic.invitationTemplateHtml}
        currentPresetId={currentPresetId}
        invitationTemplatePreview={invitationTemplatePreview}
        previewBaseUrl={previewBaseUrl}
        clinicMutation={clinicMutation}
        onHtmlChange={(html) => setClinic((c) => ({ ...c, invitationTemplateHtml: html }))}
      />
    </div>
  );
}
