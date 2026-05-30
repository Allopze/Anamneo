/// <reference types="jest" />

import { registerEncounterFollowupTasks } from './encounters-followup-tasks.e2e-group';
import { registerEncounterFollowupExportReviewTests } from './encounters-followup-export-review.e2e-group';
import { registerEncounterFollowupOutputPolicyTests } from './encounters-followup-output-policy.e2e-group';

export function registerEncounterFollowupTests() {
  registerEncounterFollowupTasks();
  registerEncounterFollowupExportReviewTests();
  registerEncounterFollowupOutputPolicyTests();
}
