import { spawn } from 'child_process';
import path from 'path';

/**
 * Startup handler for GS-Orchestrator
 * Starts the GS-Orchestrator Express server if port 9000 is not running
 */
function main() {
  console.log('🚀 [startupHandler] Starting GS-Orchestrator backend server...');
  const serverPath = path.join(__dirname, 'src', 'server.ts');
  const child = spawn('npx', ['ts-node', serverPath], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true,
    detached: true,
  });
  child.unref();
}

main();
