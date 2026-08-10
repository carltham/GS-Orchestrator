const fs = require('fs');
const path = require('path');
const http = require('http');

const PROCESS_SERVER_URL = process.env.PROCESS_SERVER_URL || 'http://localhost:9999';

console.log('[ProcessInstaller] Inspecting workspace using Node.js inspector...');

const workspaceDir = process.cwd();
const packageJsonPath = path.join(workspaceDir, 'package.json');

let projectName = 'unknown-project';
let hasPackageJson = false;

if (fs.existsSync(packageJsonPath)) {
  hasPackageJson = true;
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (pkg.name) projectName = pkg.name;
  } catch (e) {}
}

const payload = JSON.stringify({
  workspaceDir,
  projectName,
  hasPackageJson,
  timestamp: new Date().toISOString()
});

console.log(`[ProcessInstaller] Posting inspection payload to ${PROCESS_SERVER_URL}/api/installer/generate...`);

const url = new URL(`${PROCESS_SERVER_URL}/api/installer/generate`);

const req = http.request(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      fs.writeFileSync(path.join(workspaceDir, 'ProcessAdapter.js'), body);
      console.log('[ProcessInstaller] ProcessAdapter.js written successfully.');
    } else {
      console.error(`[ProcessInstaller] Error generating adapter: ${res.statusCode} ${body}`);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error(`[ProcessInstaller] Request failed: ${err.message}`);
  process.exit(1);
});

req.write(payload);
req.end();
