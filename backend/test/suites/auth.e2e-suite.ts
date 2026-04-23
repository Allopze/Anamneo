import { authBootstrapSuite } from './auth-bootstrap.e2e-suite';
import { authRegistrationSuite } from './auth-registration.e2e-suite';
import { authLoginProfileSuite } from './auth-login-profile.e2e-suite';
import { authSessionManagementSuite } from './auth-session.e2e-suite';
import { authTwoFactorSuite } from './auth-2fa.e2e-suite';

export function authSuite() {
  authBootstrapSuite();
  authRegistrationSuite();
  authLoginProfileSuite();
  authSessionManagementSuite();
  authTwoFactorSuite();
}
