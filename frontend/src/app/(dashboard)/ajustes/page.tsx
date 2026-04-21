'use client';

import { Suspense } from 'react';
import { useAjustes } from './useAjustes';
import type { AjustesTab } from './ajustes.constants';
import ProfileSecurityTab from './ProfileSecurityTab';
import ClinicTab from './ClinicTab';
import EmailTab from './EmailTab';
import SystemTab from './SystemTab';

export default function AjustesPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-fade-in max-w-5xl">
          <div className="h-8 w-32 skeleton rounded-lg mb-4" />
          <div className="h-10 w-64 skeleton rounded-lg mb-6" />
          <div className="card">
            <div className="h-48 skeleton rounded-lg" />
          </div>
        </div>
      }
    >
      <AjustesContent />
    </Suspense>
  );
}

const TAB_DEFS: { key: AjustesTab; label: string; adminOnly?: boolean }[] = [
  { key: 'perfil', label: 'Perfil y seguridad' },
  { key: 'centro', label: 'Centro médico', adminOnly: true },
  { key: 'correo', label: 'Correo e invitaciones', adminOnly: true },
  { key: 'sistema', label: 'Sistema', adminOnly: true },
];

function AjustesContent() {
  const aj = useAjustes();
  const visibleTabs = TAB_DEFS.filter((t) => !t.adminOnly || aj.isAdmin);

  return (
    <div className="animate-fade-in max-w-5xl">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Ajustes</h1>
          <p className="page-header-description">
            {aj.isAdmin
              ? 'Perfil, seguridad y configuración general del centro.'
              : 'Perfil y seguridad de tu cuenta.'}
          </p>
        </div>
      </div>

      <nav
        className="flex gap-1 mb-6 border-b border-surface-muted/40 pb-px overflow-x-auto scrollbar-none -mx-1 px-1"
        aria-label="Secciones de ajustes"
        role="tablist"
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => aj.setActiveTab(tab.key)}
            onKeyDown={aj.handleTabKeyDown}
            tabIndex={aj.activeTab === tab.key ? 0 : -1}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-bold rounded-t-xl transition-colors -mb-px ${
              aj.activeTab === tab.key
                ? 'border-b-2 border-frame-dark text-ink bg-surface-elevated'
                : 'text-ink-muted hover:text-ink hover:bg-surface-inset/60'
            }`}
            aria-selected={aj.activeTab === tab.key}
            role="tab"
            id={`tab-${tab.key}`}
            aria-controls={`tabpanel-${tab.key}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {aj.activeTab === 'perfil' && (
        <ProfileSecurityTab
          profileForm={aj.profileForm}
          profileMutation={aj.profileMutation}
          showPassword={aj.showPassword}
          setShowPassword={aj.setShowPassword}
          passwordForm={aj.passwordForm}
          passwordMutation={aj.passwordMutation}
          userRole={aj.user?.role}
        />
      )}

      {aj.activeTab === 'centro' && aj.isAdmin && (
        <ClinicTab clinic={aj.clinic} setClinic={aj.setClinic} clinicMutation={aj.clinicMutation} />
      )}

      {aj.activeTab === 'correo' && aj.isAdmin && (
        <EmailTab
          clinic={aj.clinic}
          setClinic={aj.setClinic}
          smtpPasswordConfigured={aj.smtpPasswordConfigured}
          clinicMutation={aj.clinicMutation}
          testEmail={aj.testEmail}
          setTestEmail={aj.setTestEmail}
          testInvitationMutation={aj.testInvitationMutation}
          currentPresetId={aj.currentPresetId}
          invitationTemplatePreview={aj.invitationTemplatePreview}
          invitationSubjectPreview={aj.invitationSubjectPreview}
          previewBaseUrl={aj.previewBaseUrl}
        />
      )}

      {aj.isAdmin && aj.activeTab === 'sistema' && (
        <SystemTab
          systemConfig={aj.systemConfig}
          setSystemConfig={aj.setSystemConfig}
          clinicMutation={aj.clinicMutation}
        />
      )}
    </div>
  );
}
