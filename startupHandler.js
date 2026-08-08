const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Startup handler for GS-Orchestrator
 * Spawns the GS-Orchestrator Express server on port 9000 if not running.
 */
function main() {
  console.log('🚀 [startupHandler] Starting GS-Orchestrator backend server on port 9000...');
  
  const serverPath = path.join(__dirname, 'GS-Orchestrator', 'src', 'server.ts');

  if (!fs.existsSync(serverPath)) {
    console.error(`❌ GS-Orchestrator server file not found at ${serverPath}`);
    process.exit(1);
  }

  const child = spawn('npx', ['--yes', 'ts-node', serverPath], {
    cwd: path.dirname(serverPath),
    stdio: 'inherit',
    shell: true,
    detached: true,
  });

  child.unref();
  console.log('✅ GS-Orchestrator backend process spawned successfully.');
}

main();
