import './instrument';
import { bootstrapApp } from './main.bootstrap';

bootstrapApp().catch((error) => {
  console.error(JSON.stringify({
    level: 'error',
    event: 'bootstrap_failed',
    message: error instanceof Error ? error.message : 'unknown_error',
  }));
  process.exit(1);
});
