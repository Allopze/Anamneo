import { state, prisma, req, extractCookies, cookieHeader } from '../helpers/e2e-setup';
import {
  ENCOUNTER_SECTION_ORDER,
  getEncounterSectionSchemaVersion,
} from '../../src/common/utils/encounter-section-meta';

import { validationRegistrationSuite } from './validation-registration.e2e-suite';
import { validationPatientIsolationSuite } from './validation-isolation.e2e-suite';
import { validationVolumeSuite } from './validation-volume.e2e-suite';

export function validationSuite() {
  validationRegistrationSuite();
  validationPatientIsolationSuite();
  validationVolumeSuite();
}
