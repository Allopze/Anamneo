#!/usr/bin/env node

const mode = (process.env.REGULATORY_CONSENT_ENFORCEMENT || 'soft').toLowerCase();
const nodeEnv = process.env.NODE_ENV || 'development';

if (nodeEnv === 'production' && mode !== 'hard') {
  console.warn(
    '[regulatory-smoke] REGULATORY_CONSENT_ENFORCEMENT is not hard in production. '
    + 'This is an external legal/operational blocker documented in docs/legal-postponed.md.',
  );
  process.exit(0);
}

console.log(`[regulatory-smoke] REGULATORY_CONSENT_ENFORCEMENT=${mode} NODE_ENV=${nodeEnv}`);
