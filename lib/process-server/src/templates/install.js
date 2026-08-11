const fs = require('fs');
const path = require('path');
const http = require('http');

const PROCESS_SERVER_URL = process.env.PROCESS_SERVER_URL || 'http://localhost:9999';

console.log('[ProcessInstaller] Recursively scanning workspace for projects...');

const rootDir = process.cwd();

function scanDirectory(dir, depth = 0) {
  if (depth > 3) return [];
  let projects = [];

  const items = fs.readdirSync(dir, { withFileTypes: true });
  const hasPackageJson = items.some(item => item.isFile() && item.name === 'package.json');

  if (hasPackageJson) {
    projects.push(dir);
  }

  for (const item of items) {
    if (item.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', '.angular'].includes(item.name)) continue;
      const subDir = path.join(dir, item.name);
      projects = projects.concat(scanDirectory(subDir, depth + 1));
    }
  }

  return projects;
}

function installAdapterForProject(targetDir) {
  const packageJsonPath = path.join(targetDir, 'package.json');
  let projectName = path.basename(targetDir);

  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (pkg.name) projectName = pkg.name;
    } catch (e) {}
  }

  console.log(`[ProcessInstaller] Generating adapter for '${projectName}' in ${targetDir}...`);

  const payload = JSON.stringify({
    workspaceDir: targetDir,
    projectName,
    hasPackageJson: true,
    timestamp: new Date().toISOString()
  });

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
        fs.writeFileSync(path.join(targetDir, 'ProcessAdapter.js'), body);
        console.log(`[ProcessInstaller] ProcessAdapter.js written -> ${path.join(targetDir, 'ProcessAdapter.js')}`);
      } else {
        console.error(`[ProcessInstaller] Failed for ${projectName}: ${res.statusCode} ${body}`);
      }
    });
  });

  req.on('error', (err) => {
    console.error(`[ProcessInstaller] Request failed for ${projectName}: ${err.message}`);
  });

  req.write(payload);
  req.end();
}

const discoveredProjects = scanDirectory(rootDir);
console.log(`[ProcessInstaller] Discovered ${discoveredProjects.length} project(s).`);

for (const projDir of discoveredProjects) {
  installAdapterForProject(projDir);
}
