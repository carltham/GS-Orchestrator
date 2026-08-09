export * from './types';
export * from './config';
export * from './discovery/detector';
export * from './api/apiClient';
export * from './startup/prestart';
export * from './launcher/health';
export * from './launcher/commands';
export * from './launcher/launcher';

import { OrchestratedLauncher } from './launcher/launcher';

if (require.main === module) {
  const launcher = new OrchestratedLauncher();
  launcher.start().catch((err) => {
    console.error('Fatal launcher error:', err);
    process.exit(1);
  });
}
