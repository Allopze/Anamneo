import { state, req, extractCookies, cookieHeader, prisma } from '../helpers/e2e-setup';
import { authenticator } from '@otplib/v12-adapter';
import { authBootstrapSuite } from './auth-bootstrap.e2e-suite';
import { authRegistrationSuite } from './auth-registration.e2e-suite';
import { authLoginProfileSuite } from './auth-login-profile.e2e-suite';
import { authSessionManagementSuite } from './auth-session.e2e-suite';
import { authTwoFactorSuite } from './auth-2fa.e2e-suite';

const TEST_BOOTSTRAP_TOKEN = 'bootstrap-token-e2e-0123456789abcdef';

export function authSuite() {
  authBootstrapSuite();
  authRegistrationSuite();
  authLoginProfileSuite();
  authSessionManagementSuite();
  authTwoFactorSuite();
}
