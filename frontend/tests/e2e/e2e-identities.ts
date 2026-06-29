/**
 * E2E identity constants.
 *
 * Admin credentials are FIXED because bootstrap only happens once.
 * The medico uses a RUN_ID suffix to avoid collisions across parallel runs.
 */

export const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Fixed admin — matches the one-time bootstrap registration
export const ADMIN_EMAIL = 'admin@e2e-test.local';
export const ADMIN_PASSWORD = 'TestPass123!';
export const ADMIN_NOMBRE = 'Admin E2E';

// Medico is created fresh each run via invitation
export const MEDICO_EMAIL = `medico+${RUN_ID}@e2e-test.local`;
export const MEDICO_PASSWORD = 'MedicoPass123!';

export const BOOTSTRAP_TOKEN = 'e2e-bootstrap-token';