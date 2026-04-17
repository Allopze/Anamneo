export const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const ADMIN_EMAIL = `admin+${RUN_ID}@e2e-test.local`;
export const ADMIN_PASSWORD = 'TestPass123!';
export const ADMIN_NOMBRE = 'Admin E2E';

export const MEDICO_EMAIL = `medico+${RUN_ID}@e2e-test.local`;
export const MEDICO_PASSWORD = 'MedicoPass123!';

export const BOOTSTRAP_TOKEN = 'e2e-bootstrap-token';