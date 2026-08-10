export * from './types';
export * from './config';
export * from './discovery/detector';
export * from './api/apiClient';
export * from './startup/prestart';
export * from './launcher/health';
export * from './launcher/commands';
export * from './launcher/launcher';

import { detectProjectName } from './config';
import { OrchestratedLauncher } from './launcher/launcher';
import { runPrestart } from './startup/prestart';

if (require.main === module) {
  const isOrchestratorRepo = detectProjectName() === 'gs-orchestrator';
  if (isOrchestratorRepo) {
    runPrestart().catch((err: unknown) => {
      console.error('Fatal prestart error:', err);
      process.exit(1);
    });
  } else {
    const launcher = new OrchestratedLauncher();
    launcher.start().catch((err: unknown) => {
      console.error('Fatal launcher error:', err);
      process.exit(1);
    });
  }
}
