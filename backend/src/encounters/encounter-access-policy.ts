import {
  canRoleViewEncounterSection,
  isMedicoOnlyEncounterSection,
} from '../../../shared/encounter-permission-contract';
import { SectionKey } from '../common/types';

export function isMedicoOnlySection(sectionKey: SectionKey) {
  return isMedicoOnlyEncounterSection(sectionKey);
}

export function shouldHideEncounterSectionForRole(role: string | undefined, sectionKey: SectionKey) {
  return role === 'ASISTENTE' && !canRoleViewEncounterSection(role, sectionKey);
}
