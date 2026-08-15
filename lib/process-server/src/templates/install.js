const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const PROCESS_SERVER_URL = process.env.PROCESS_SERVER_URL || 'http://localhost:9999';

console.log('[ProcessInstaller] Installing into current project...');

const rootDir = process.cwd();

function requestClient(url, options, callback) {
  return (url.protocol === 'https:' ? https : http).request(url, options, callback);
}

function installAdapterForProject(targetDir) {
  const packageJsonPath = path.join(targetDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`No package.json found in ${targetDir}`);
  }

  let projectName = path.basename(targetDir);

  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (pkg.name) projectName = pkg.name;
    } catch (e) {}
  }

  // Skip infrastructure packages: process-client and process-server
  if (['@gs/process-client', '@gs/process-server', 'process-client', 'process-server'].includes(projectName)) {
    console.log(`[ProcessInstaller] Skipping infrastructure directory: '${projectName}'`);
    return;
  }

  console.log(`[ProcessInstaller] Generating adapter for '${projectName}' in ${targetDir}...`);

  const payload = JSON.stringify({
    workspaceDir: targetDir,
    projectName,
    hasPackageJson: true,
    timestamp: new Date().toISOString()
  });

  const url = new URL(`${PROCESS_SERVER_URL}/ps/installer/generate`);

  const req = requestClient(url, {
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
        if (!body.includes('class ProcessAdapter') || !body.includes('module.exports = ProcessAdapter')) {
          console.error('[ProcessInstaller] Server returned an invalid ProcessAdapter.js');
          process.exitCode = 1;
          return;
        }

        const adapterPath = path.join(targetDir, 'ProcessAdapter.js');
        const adapterTmpPath = `${adapterPath}.tmp`;
        fs.writeFileSync(adapterTmpPath, body);
        fs.renameSync(adapterTmpPath, adapterPath);
        console.log(`[ProcessInstaller] ProcessAdapter.js written -> ${adapterPath}`);
        
        try {
          console.log(`[ProcessInstaller] Installing @gs/process-client via remote HTTP tarball package...`);
          execFileSync('npm', ['install', '--no-audit', '--no-fund', `${PROCESS_SERVER_URL}/packages/process-client.tgz`], {
            cwd: targetDir,
            stdio: 'inherit'
          });

          console.log(`[ProcessInstaller] Fetching and saving CLIENT_INSTALLATION.md...`);
          const docUrl = new URL(`${PROCESS_SERVER_URL}/install/instructions`);
          (docUrl.protocol === 'https:' ? https : http).get(docUrl, (docRes) => {
            let docText = '';
            docRes.on('data', chunk => docText += chunk);
            docRes.on('end', () => {
              if (docRes.statusCode === 200 && docText) {
                fs.writeFileSync(path.join(targetDir, 'CLIENT_INSTALLATION.md'), docText);
                console.log(`[ProcessInstaller] CLIENT_INSTALLATION.md saved to -> ${path.join(targetDir, 'CLIENT_INSTALLATION.md')}`);
                console.log(`[ProcessInstaller] Installation complete. Run 'npm start' to start the client and local services.`);
              }
            });
          });
        } catch (installErr) {
          console.error(`[ProcessInstaller] Failed to install client package in ${targetDir}: ${installErr.message}`);
        }
      } else {
        console.error(`[ProcessInstaller] Failed for ${projectName}: ${res.statusCode} ${body}`);
        process.exitCode = 1;
      }
    });
  });

  req.on('error', (err) => {
    console.error(`[ProcessInstaller] Request failed for ${projectName}: ${err.message}`);
    process.exitCode = 1;
  });

  req.write(payload);
  req.end();
}

installAdapterForProject(rootDir);
