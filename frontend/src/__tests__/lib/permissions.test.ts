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
  canViewEncounterSection,
  canUpdateEncounterReviewStatus,
  canEditEncounter,
  canCompleteEncounter,
  canCancelEncounter,
  canCreatePatientTask,
  canExportEncounterDocuments,
  canPrintEncounterRecord,
  canReopenEncounter,
  canSignEncounter,
  canViewEncounterAudit,
  PermissionUser,
} from '@/lib/permissions';
import { Encounter, SectionKey } from '@/types';
import { MEDICO_ONLY_SECTION_KEYS } from '../../../../shared/encounter-section-policy';

const medico: PermissionUser = { id: '1', role: 'MEDICO' };
const admin: PermissionUser = { id: '2', role: 'ADMIN', isAdmin: true };
const asistente: PermissionUser = { id: '3', role: 'ASISTENTE', medicoId: 'med1' };
const asistenteNoMedico: PermissionUser = { id: '4', role: 'ASISTENTE', medicoId: null };
const SECTION_VISIBILITY_CLASSIFICATION: Record<SectionKey, 'SHARED' | 'MEDICO_ONLY'> = {
  IDENTIFICACION: 'SHARED',
  MOTIVO_CONSULTA: 'SHARED',
  ANAMNESIS_PROXIMA: 'SHARED',
  ANAMNESIS_REMOTA: 'SHARED',
  REVISION_SISTEMAS: 'SHARED',
  EXAMEN_FISICO: 'SHARED',
  SOSPECHA_DIAGNOSTICA: 'MEDICO_ONLY',
  TRATAMIENTO: 'MEDICO_ONLY',
  RESPUESTA_TRATAMIENTO: 'MEDICO_ONLY',
  OBSERVACIONES: 'SHARED',
};

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

  it('canCreatePatientTask — medico and assigned assistant only', () => {
    expect(canCreatePatientTask(medico)).toBe(true);
    expect(canCreatePatientTask(asistente)).toBe(true);
    expect(canCreatePatientTask(asistenteNoMedico)).toBe(false);
    expect(canCreatePatientTask(admin)).toBe(false);
  });

  it('canViewMedicoOnlySections', () => {
    expect(canViewMedicoOnlySections(medico)).toBe(true);
    expect(canViewMedicoOnlySections(admin)).toBe(false);
    expect(canViewMedicoOnlySections(asistente)).toBe(false);
  });

  it('canViewEncounterSection', () => {
    expect(canViewEncounterSection(medico, 'TRATAMIENTO')).toBe(true);
    expect(canViewEncounterSection(asistente, 'TRATAMIENTO')).toBe(false);
    expect(canViewEncounterSection(asistente, 'MOTIVO_CONSULTA')).toBe(true);
    expect(canViewEncounterSection(admin, 'MOTIVO_CONSULTA')).toBe(false);
  });

  it('canUpdateEncounterReviewStatus', () => {
    expect(canUpdateEncounterReviewStatus(medico, 'REVISADA_POR_MEDICO')).toBe(true);
    expect(canUpdateEncounterReviewStatus(medico, 'NO_REQUIERE_REVISION')).toBe(true);
    expect(canUpdateEncounterReviewStatus(medico, 'LISTA_PARA_REVISION')).toBe(false);
    expect(canUpdateEncounterReviewStatus(asistente, 'LISTA_PARA_REVISION')).toBe(true);
    expect(canUpdateEncounterReviewStatus(asistente, 'REVISADA_POR_MEDICO')).toBe(false);
    expect(canUpdateEncounterReviewStatus(admin, 'NO_REQUIERE_REVISION')).toBe(false);
  });

  it('classifies every encounter section explicitly and keeps medico-only keys in sync', () => {
    const medicoOnlyKeys = Object.entries(SECTION_VISIBILITY_CLASSIFICATION)
      .filter(([, visibility]) => visibility === 'MEDICO_ONLY')
      .map(([sectionKey]) => sectionKey)
      .sort();

    expect(medicoOnlyKeys).toEqual([...MEDICO_ONLY_SECTION_KEYS].sort());
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

  const signedEncounter = {
    status: 'FIRMADO',
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

  it('canCompleteEncounter — only medico on active in-progress encounter', () => {
    const ownActiveEncounter = {
      status: 'EN_PROGRESO',
      createdBy: { id: '1' },
    } as unknown as Encounter;
    expect(canCompleteEncounter(medico, ownActiveEncounter)).toBe(true);
    expect(canCompleteEncounter(admin, activeEncounter)).toBe(false);
    expect(canCompleteEncounter(asistente, activeEncounter)).toBe(false);
    expect(canCompleteEncounter(medico, completedEncounter)).toBe(false);
    expect(canCompleteEncounter(medico, activeEncounter)).toBe(true);
  });

  it('canUploadAttachments — blocks completed and signed encounters even for valid roles', () => {
    expect(canUploadAttachments(medico, activeEncounter)).toBe(true);
    expect(canUploadAttachments(asistente, activeEncounter)).toBe(true);
    expect(canUploadAttachments(medico, completedEncounter)).toBe(false);
    expect(canUploadAttachments(asistente, signedEncounter)).toBe(false);
  });

  it('canSignEncounter — only medico on completed encounter', () => {
    expect(canSignEncounter(medico, completedEncounter)).toBe(true);
    expect(canSignEncounter(asistente, completedEncounter)).toBe(false);
    expect(canSignEncounter(admin, completedEncounter)).toBe(false);
    expect(canSignEncounter(medico, activeEncounter)).toBe(false);
  });

  it('canReopenEncounter — only medico on completed encounter', () => {
    expect(canReopenEncounter(medico, completedEncounter)).toBe(true);
    expect(canReopenEncounter(asistente, completedEncounter)).toBe(false);
    expect(canReopenEncounter(admin, completedEncounter)).toBe(false);
    expect(canReopenEncounter(medico, activeEncounter)).toBe(false);
  });

  it('canCancelEncounter — only medico on in-progress encounter', () => {
    expect(canCancelEncounter(medico, activeEncounter)).toBe(true);
    expect(canCancelEncounter(asistente, activeEncounter)).toBe(false);
    expect(canCancelEncounter(admin, activeEncounter)).toBe(false);
    expect(canCancelEncounter(medico, completedEncounter)).toBe(false);
  });

  it('canExportEncounterDocuments and canPrintEncounterRecord — medico and assistant only', () => {
    expect(canExportEncounterDocuments(medico)).toBe(true);
    expect(canExportEncounterDocuments(asistente)).toBe(true);
    expect(canExportEncounterDocuments(admin)).toBe(false);
    expect(canPrintEncounterRecord(medico)).toBe(true);
    expect(canPrintEncounterRecord(asistente)).toBe(true);
    expect(canPrintEncounterRecord(admin)).toBe(false);
  });

  it('canViewEncounterAudit — medico and assistant only', () => {
    expect(canViewEncounterAudit(medico)).toBe(true);
    expect(canViewEncounterAudit(asistente)).toBe(true);
    expect(canViewEncounterAudit(admin)).toBe(false);
  });
});
