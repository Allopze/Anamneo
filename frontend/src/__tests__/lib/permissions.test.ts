import {
  isMedicoUser,
  isAssistantUser,
  isAdminUser,
  hasAssignedMedico,
  canCreatePatient,
  canCreateEncounter,
  canEditPatientAdmin,
  canImportConditionsCsv,
  canUploadAttachments,
  canEditAntecedentes,
  canViewMedicoOnlySections,
  canEditEncounter,
  canCompleteEncounter,
  PermissionUser,
} from '@/lib/permissions';
import { Encounter } from '@/types';

const medico: PermissionUser = { id: '1', role: 'MEDICO' };
const admin: PermissionUser = { id: '2', role: 'ADMIN', isAdmin: true };
const asistente: PermissionUser = { id: '3', role: 'ASISTENTE', medicoId: 'med1' };
const asistenteNoMedico: PermissionUser = { id: '4', role: 'ASISTENTE', medicoId: null };

describe('role checks', () => {
  it('isMedicoUser', () => {
    expect(isMedicoUser(medico)).toBe(true);
    expect(isMedicoUser(admin)).toBe(false);
    expect(isMedicoUser(asistente)).toBe(false);
    expect(isMedicoUser(null)).toBe(false);
  });

  it('isAssistantUser', () => {
    expect(isAssistantUser(asistente)).toBe(true);
    expect(isAssistantUser(medico)).toBe(false);
    expect(isAssistantUser(null)).toBe(false);
  });

  it('isAdminUser', () => {
    expect(isAdminUser(admin)).toBe(true);
    expect(isAdminUser(medico)).toBe(false);
    expect(isAdminUser({ id: '5', role: 'MEDICO', isAdmin: true })).toBe(true);
    expect(isAdminUser(null)).toBe(false);
  });

  it('hasAssignedMedico', () => {
    expect(hasAssignedMedico(asistente)).toBe(true);
    expect(hasAssignedMedico(asistenteNoMedico)).toBe(false);
    expect(hasAssignedMedico(medico)).toBe(false);
    expect(hasAssignedMedico(null)).toBe(false);
  });
});

describe('feature guards', () => {
  it('canCreatePatient — medico and assigned assistant can, admin cannot', () => {
    expect(canCreatePatient(medico)).toBe(true);
    expect(canCreatePatient(admin)).toBe(false);
    expect(canCreatePatient(asistente)).toBe(true);
    expect(canCreatePatient(asistenteNoMedico)).toBe(false);
    expect(canCreatePatient(null)).toBe(false);
  });

  it('canCreateEncounter', () => {
    expect(canCreateEncounter(medico)).toBe(true);
    expect(canCreateEncounter(admin)).toBe(false);
    expect(canCreateEncounter(asistente)).toBe(true);
    expect(canCreateEncounter(asistenteNoMedico)).toBe(false);
  });

  it('canEditPatientAdmin', () => {
    expect(canEditPatientAdmin(medico)).toBe(true);
    expect(canEditPatientAdmin(asistente)).toBe(true);
    expect(canEditPatientAdmin(admin)).toBe(false);
  });

  it('canUploadAttachments', () => {
    expect(canUploadAttachments(medico)).toBe(true);
    expect(canUploadAttachments(asistente)).toBe(true);
    expect(canUploadAttachments(admin)).toBe(false);
    expect(canUploadAttachments(asistenteNoMedico)).toBe(false);
  });

  it('canImportConditionsCsv', () => {
    expect(canImportConditionsCsv(admin)).toBe(true);
    expect(canImportConditionsCsv(medico)).toBe(false);
    expect(canImportConditionsCsv(asistente)).toBe(false);
    expect(canImportConditionsCsv({ id: '5', role: 'MEDICO', isAdmin: true })).toBe(false);
  });

  it('canEditAntecedentes — medico and assigned assistant only', () => {
    expect(canEditAntecedentes(medico)).toBe(true);
    expect(canEditAntecedentes(asistente)).toBe(true);
    expect(canEditAntecedentes(asistenteNoMedico)).toBe(false);
    expect(canEditAntecedentes(admin)).toBe(false);
  });

  it('canViewMedicoOnlySections', () => {
    expect(canViewMedicoOnlySections(medico)).toBe(true);
    expect(canViewMedicoOnlySections(admin)).toBe(false);
    expect(canViewMedicoOnlySections(asistente)).toBe(false);
  });
});

describe('encounter-level permissions', () => {
  const activeEncounter = {
    status: 'EN_PROGRESO',
    createdBy: { id: '3' },
  } as unknown as Encounter;

  const completedEncounter = {
    status: 'COMPLETADO',
    createdBy: { id: '1' },
  } as unknown as Encounter;

  it('canEditEncounter — medico on active encounter', () => {
    expect(canEditEncounter(medico, activeEncounter)).toBe(true);
  });

  it('canEditEncounter — admin on active encounter', () => {
    expect(canEditEncounter(admin, activeEncounter)).toBe(false);
  });

  it('canEditEncounter — creator on active encounter', () => {
    expect(canEditEncounter(asistente, activeEncounter)).toBe(true);
  });

  it('canEditEncounter — false on completed encounter', () => {
    expect(canEditEncounter(medico, completedEncounter)).toBe(false);
  });

  it('canEditEncounter — false for null user', () => {
    expect(canEditEncounter(null, activeEncounter)).toBe(false);
  });

  it('canCompleteEncounter — only medico on active own encounter', () => {
    const ownActiveEncounter = {
      status: 'EN_PROGRESO',
      createdBy: { id: '1' },
    } as unknown as Encounter;
    expect(canCompleteEncounter(medico, ownActiveEncounter)).toBe(true);
    expect(canCompleteEncounter(admin, activeEncounter)).toBe(false);
    expect(canCompleteEncounter(asistente, activeEncounter)).toBe(false);
    expect(canCompleteEncounter(medico, completedEncounter)).toBe(false);
    // Medico cannot complete encounter created by someone else
    expect(canCompleteEncounter(medico, activeEncounter)).toBe(false);
  });
});
