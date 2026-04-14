import { bootstrapApp, teardownApp } from './helpers/e2e-setup';
import { healthSuite } from './suites/health.e2e-suite';
import { authSuite } from './suites/auth.e2e-suite';
import { conditionsSuite } from './suites/conditions.e2e-suite';
import { patientsSuite } from './suites/patients.e2e-suite';
import { encountersSuite } from './suites/encounters.e2e-suite';
import { conditionSuggestionsSuite } from './suites/condition-suggestions.e2e-suite';
import { adminSuite } from './suites/admin.e2e-suite';
import { validationSuite } from './suites/validation.e2e-suite';

describe('Application E2E Tests', () => {
  beforeAll(bootstrapApp, 30_000);
  afterAll(teardownApp);

  healthSuite();
  authSuite();
  conditionsSuite();
  patientsSuite();
  encountersSuite();
  conditionSuggestionsSuite();
  adminSuite();
  validationSuite();
});
