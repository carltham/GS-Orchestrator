export * from './types/IProcessAdapter';
export * from './launcher/ProcessClient';

// Executable entry point when invoked directly via node
if (require.main === module) {
  const path = require('path');
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  let projectName = 'unknown-project';

  try {
    const pkg = require(pkgPath);
    if (pkg.name) projectName = pkg.name;
  } catch (e) {}

  const { ProcessClient } = require('./launcher/ProcessClient');
  const client = new ProcessClient({ projectName });
  
  client.start().catch((err: any) => {
    console.error(`[ProcessClient] Startup error: ${err.message}`);
    process.exit(1);
  });
}

