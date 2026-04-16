import { MEDICO_ONLY_SECTION_KEYS } from '../../../shared/encounter-section-policy';
import { SectionKey } from '../common/types';

const MEDICO_ONLY_SECTION_SET = new Set<SectionKey>(MEDICO_ONLY_SECTION_KEYS);

export function isMedicoOnlySection(sectionKey: SectionKey) {
  return MEDICO_ONLY_SECTION_SET.has(sectionKey);
}

export function shouldHideEncounterSectionForRole(role: string | undefined, sectionKey: SectionKey) {
  return role === 'ASISTENTE' && isMedicoOnlySection(sectionKey);
}