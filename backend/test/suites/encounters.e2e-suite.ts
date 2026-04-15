/// <reference types="jest" />

import { registerEncounterSectionTests } from './encounters/encounters-sections.e2e-group';
import { registerEncounterFollowupTests } from './encounters/encounters-followup.e2e-group';
import { registerEncounterWorkflowTests } from './encounters/encounters-workflow.e2e-group';

export function encountersSuite() {
  describe('Encounters', () => {
    registerEncounterSectionTests();
    registerEncounterFollowupTests();
    registerEncounterWorkflowTests();
  });
}
