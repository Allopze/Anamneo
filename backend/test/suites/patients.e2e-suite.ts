import { patientsRegistrationSuite } from './patients-registration.e2e-suite';
import { patientsHistoryAdminSuite } from './patients-history-admin.e2e-suite';
import { patientsMergeArchiveSuite } from './patients-merge-archive.e2e-suite';

export function patientsSuite() {
  patientsRegistrationSuite();
  patientsHistoryAdminSuite();
  patientsMergeArchiveSuite();
}
