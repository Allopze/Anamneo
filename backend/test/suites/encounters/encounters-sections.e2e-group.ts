/// <reference types="jest" />

import { registerEncounterSectionCoreTests } from './encounters-sections-core.e2e-group';
import { registerEncounterSectionValidationTests } from './encounters-sections-validation.e2e-group';

export function registerEncounterSectionTests() {
  registerEncounterSectionCoreTests();
  registerEncounterSectionValidationTests();
}
