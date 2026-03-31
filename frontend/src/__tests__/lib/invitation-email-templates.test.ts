import {
  getDefaultInvitationTemplateHtml,
  getDefaultInvitationSubjectTemplate,
  INVITATION_TEMPLATE_PRESETS,
  renderInvitationTextTemplate,
  renderInvitationTemplatePreview,
} from '@/lib/invitation-email-templates';

describe('invitation email templates', () => {
  it('ships multiple presets with logo token', () => {
    expect(INVITATION_TEMPLATE_PRESETS.length).toBeGreaterThanOrEqual(3);
    INVITATION_TEMPLATE_PRESETS.forEach((preset) => {
      expect(preset.html).toContain('{{logoUrl}}');
    });
  });

  it('renders placeholders into html preview', () => {
    const rendered = renderInvitationTemplatePreview(
      '<div>{{clinicName}} {{recipientEmail}} {{assignedMedicoSection}}</div>',
      {
        clinicName: 'Clinica Norte',
        recipientEmail: 'doc@demo.cl',
        inviteUrl: 'https://demo.cl/register?token=123',
        roleLabel: 'medico',
        expirationLabel: '18-03-2026 12:00',
        assignedMedicoName: 'Dra. Ruiz',
        assignedMedicoSection: '<p><strong>Dra. Ruiz</strong></p>',
        logoUrl: 'https://demo.cl/anamneo-logo.svg',
        year: '2026',
      },
    );

    expect(rendered).toContain('Clinica Norte');
    expect(rendered).toContain('doc@demo.cl');
    expect(rendered).toContain('<p><strong>Dra. Ruiz</strong></p>');
  });

  it('uses the default preset when html is blank', () => {
    const rendered = renderInvitationTemplatePreview('', {
      clinicName: 'Anamneo',
      recipientEmail: 'demo@anamneo.cl',
      inviteUrl: 'https://anamneo.cl/register?token=demo',
      roleLabel: 'medico',
      expirationLabel: '20-03-2026 09:00',
      assignedMedicoName: '',
      assignedMedicoSection: '',
      logoUrl: 'https://anamneo.cl/anamneo-logo.svg',
      year: '2026',
    });

    expect(rendered).toContain('https://anamneo.cl/anamneo-logo.svg');
    expect(rendered).toContain('https://anamneo.cl/register?token=demo');
    expect(rendered).toContain(getDefaultInvitationTemplateHtml().slice(0, 40));
  });

  it('renders a text subject template', () => {
    const rendered = renderInvitationTextTemplate('Invitacion {{roleLabel}} - {{clinicName}}', {
      clinicName: 'Clinica Norte',
      recipientEmail: 'doc@demo.cl',
      inviteUrl: 'https://demo.cl/register?token=123',
      roleLabel: 'medico',
      expirationLabel: '18-03-2026 12:00',
      assignedMedicoName: 'Dra. Ruiz',
      assignedMedicoSection: '<p><strong>Dra. Ruiz</strong></p>',
      logoUrl: 'https://demo.cl/anamneo-logo.svg',
      year: '2026',
    });

    expect(rendered).toBe('Invitacion medico - Clinica Norte');
    expect(getDefaultInvitationSubjectTemplate()).toContain('{{clinicName}}');
  });
});