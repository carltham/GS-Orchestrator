const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const PROCESS_SERVER_URL = process.env.PROCESS_SERVER_URL || 'http://localhost:9999';
const CLIENT_START_COMMAND = 'node node_modules/@gs/process-client/dist/index.js';
const MAX_FALLBACK_DEPTH = 3;
const IGNORED_DIRECTORIES = new Set(['.git', 'dist', 'build', 'coverage', 'node_modules', 'test-results']);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function globToRegExp(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '___DOUBLE_STAR___')
    .replace(/\*/g, '[^/]*')
    .replace(/___DOUBLE_STAR___/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function collectPackageFiles(rootDir, currentDir = rootDir, depth = 0, results = []) {
  if (depth > MAX_FALLBACK_DEPTH) return results;

  const packagePath = path.join(currentDir, 'package.json');
  if (fs.existsSync(packagePath)) results.push(packagePath);
  if (depth === MAX_FALLBACK_DEPTH) return results;

  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || IGNORED_DIRECTORIES.has(entry.name)) continue;
    collectPackageFiles(rootDir, path.join(currentDir, entry.name), depth + 1, results);
  }
  return results;
}

function workspacePatterns(rootPackage) {
  if (Array.isArray(rootPackage.workspaces)) return rootPackage.workspaces;
  if (Array.isArray(rootPackage.workspaces?.packages)) return rootPackage.workspaces.packages;
  return [];
}

function discoverPackageFiles(rootDir, rootPackage) {
  const allPackages = collectPackageFiles(rootDir);
  const patterns = workspacePatterns(rootPackage).map(globToRegExp);
  if (patterns.length === 0) return allPackages;

  return allPackages.filter((packagePath) => {
    if (packagePath === path.join(rootDir, 'package.json')) return true;
    const relativeDir = toPosix(path.relative(rootDir, path.dirname(packagePath)));
    return patterns.some((pattern) => pattern.test(relativeDir));
  });
}

function loadConfiguredPorts(rootDir) {
  const candidates = [
    path.join(rootDir, 'config', 'app-config.json'),
    path.join(rootDir, 'config', 'net-config.json')
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const config = readJson(candidate);
      return {
        backend: Number(config.backend) || undefined,
        frontend: Number(config.frontend) || undefined,
        database: Number(config.database) || undefined
      };
    } catch {}
  }
  return {};
}

function classifyPackage(packagePath, rootDir, configuredPorts) {
  const packageData = readJson(packagePath);
  const relativePath = toPosix(path.relative(rootDir, path.dirname(packagePath))) || '.';
  const searchable = `${packageData.name || ''} ${relativePath}`.toLowerCase();
  const dependencies = { ...packageData.dependencies, ...packageData.devDependencies };
  const scripts = packageData.scripts || {};

  if (dependencies['@nativescript/core'] || /(^|\/)mobile($|\/)/.test(relativePath)) return null;

  const scriptName = scripts.dev ? 'dev' : scripts.start ? 'start' : null;
  if (!scriptName) return null;

  let serviceType = 'service';
  if (dependencies.express || dependencies.fastify || dependencies['@nestjs/core'] || /backend|server|api/.test(searchable)) {
    serviceType = 'backend';
  } else if (dependencies.vite || dependencies['@angular/core'] || dependencies.react || /frontend|web/.test(searchable)) {
    serviceType = 'frontend';
  }

  return {
    name: serviceType,
    relativePath,
    serviceType,
    command: { executable: 'npm', args: ['run', scriptName] },
    configuredPort: configuredPorts[serviceType]
  };
}

function discoverComposeDatabases(rootDir, configuredPorts) {
  const composeFiles = fs.readdirSync(rootDir).filter((name) => /^docker-compose.*\.ya?ml$/i.test(name));
  const components = [];

  for (const composeFile of composeFiles) {
    const lines = fs.readFileSync(path.join(rootDir, composeFile), 'utf8').split(/\r?\n/);
    let serviceName;
    let image = '';
    let configuredPort;
    let inServices = false;

    const flushService = () => {
      if (!serviceName || !/(postgres|mysql|mariadb|mongo|redis)/i.test(`${serviceName} ${image}`)) return;
      components.push({
        name: components.length === 0 ? 'database' : `database-${serviceName}`,
        relativePath: '.',
        serviceType: 'database',
        command: { executable: 'docker', args: ['compose', '-f', composeFile, 'up', serviceName] },
        stopCommand: { executable: 'docker', args: ['compose', '-f', composeFile, 'stop', serviceName] },
        configuredPort: configuredPort || configuredPorts.database
      });
    };

    for (const line of lines) {
      if (/^services:\s*$/.test(line)) {
        inServices = true;
        continue;
      }
      if (inServices && /^\S[^:]*:\s*$/.test(line) && !/^services:\s*$/.test(line)) {
        flushService();
        serviceName = undefined;
        inServices = false;
        continue;
      }
      if (!inServices) continue;
      const serviceMatch = line.match(/^  ([A-Za-z0-9_-]+):\s*$/);
      if (serviceMatch) {
        flushService();
        serviceName = serviceMatch[1];
        image = '';
        configuredPort = undefined;
        continue;
      }
      if (!serviceName) continue;
      const imageMatch = line.match(/^\s+image:\s*([^#]+)$/);
      if (imageMatch) image = imageMatch[1].trim();
      const portMatch = line.match(/["']?(\d+):(\d+)["']?/);
      if (portMatch) configuredPort = Number(portMatch[1]);
    }
    if (inServices) flushService();
  }
  return components;
}

function ensureUniqueNames(components) {
  const counts = new Map();
  return components.map((component) => {
    const count = (counts.get(component.name) || 0) + 1;
    counts.set(component.name, count);
    return count === 1 ? component : { ...component, name: `${component.name}-${count}` };
  });
}

function discoverComponents(rootDir, rootPackage = readJson(path.join(rootDir, 'package.json'))) {
  const configuredPorts = loadConfiguredPorts(rootDir);
  const packageFiles = discoverPackageFiles(rootDir, rootPackage);
  const workspacePackageFiles = workspacePatterns(rootPackage).length > 0
    ? packageFiles.filter((candidate) => candidate !== path.join(rootDir, 'package.json'))
    : packageFiles;
  const packageComponents = workspacePackageFiles
    .map((candidate) => classifyPackage(candidate, rootDir, configuredPorts))
    .filter(Boolean);
  return ensureUniqueNames([
    ...packageComponents,
    ...discoverComposeDatabases(rootDir, configuredPorts)
  ]);
}

function requestBuffer(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const request = client.request(url, options, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks);
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(body);
        else reject(new Error(`${response.statusCode}: ${body.toString('utf8')}`));
      });
    });
    request.on('error', reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

async function requestBufferWithRetry(url, options = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await requestBuffer(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }
  }
  throw lastError;
}

function createPackageBackup(rootDir) {
  const packagePath = path.join(rootDir, 'package.json');
  let backupPath = path.join(rootDir, 'package.json.process-client.backup');
  if (fs.existsSync(backupPath)) {
    backupPath = path.join(rootDir, `package.json.process-client.${Date.now()}.backup`);
  }
  fs.copyFileSync(packagePath, backupPath);
  return backupPath;
}

function configureStartup(rootDir, originalStart) {
  const packagePath = path.join(rootDir, 'package.json');
  const packageData = readJson(packagePath);
  packageData.scripts = packageData.scripts || {};
  if (originalStart && originalStart !== CLIENT_START_COMMAND && !packageData.scripts['start:before-process-client']) {
    packageData.scripts['start:before-process-client'] = originalStart;
  }
  packageData.scripts.start = CLIENT_START_COMMAND;
  fs.writeFileSync(packagePath, `${JSON.stringify(packageData, null, 2)}\n`);
}

async function install() {
  const rootDir = process.cwd();
  const packagePath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(packagePath)) throw new Error(`No package.json found in ${rootDir}`);

  const rootPackage = readJson(packagePath);
  const projectName = rootPackage.name || path.basename(rootDir);
  const components = discoverComponents(rootDir, rootPackage);

  if (components.length === 0) {
    throw new Error('No runnable components were discovered; installation was not changed');
  }

  console.log(`[ProcessInstaller] Found ${components.length} managed component(s):`);
  for (const component of components) {
    console.log(`  - ${component.name} (${component.serviceType}) at ${component.relativePath}`);
  }

  const payload = JSON.stringify({
    workspaceDir: rootDir,
    projectName,
    hasPackageJson: true,
    timestamp: new Date().toISOString(),
    components
  });
  const adapter = await requestBuffer(new URL(`${PROCESS_SERVER_URL}/ps/installer/generate`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    },
    body: payload
  });
  const adapterText = adapter.toString('utf8');
  if (!adapterText.includes('class ProcessAdapter') || !adapterText.includes('componentDefinitions')) {
    throw new Error('ProcessServer returned an invalid aggregate ProcessAdapter.js');
  }

  fs.writeFileSync(path.join(rootDir, 'ProcessAdapter.js'), adapter);
  const backupPath = createPackageBackup(rootDir);
  console.log(`[ProcessInstaller] Original package manifest backed up to ${backupPath}`);

  execFileSync('npm', ['install', '--no-audit', '--no-fund', `${PROCESS_SERVER_URL}/packages/process-client.tgz`], {
    cwd: rootDir,
    stdio: 'inherit'
  });
  configureStartup(rootDir, rootPackage.scripts?.start);

  try {
    const instructions = await requestBufferWithRetry(new URL(`${PROCESS_SERVER_URL}/install/instructions`));
    fs.writeFileSync(path.join(rootDir, 'CLIENT_INSTALLATION.md'), instructions);
  } catch (error) {
    console.warn(`[ProcessInstaller] Could not download instructions: ${error.message}`);
  }

  console.log('[ProcessInstaller] Installation complete. Run npm start to launch the client and managed components.');
  console.log(`[ProcessInstaller] Manual restoration backup: ${backupPath}`);
}

if (require.main === module) {
  install().catch((error) => {
    console.error(`[ProcessInstaller] Installation failed: ${error.message}`);
    console.error('[ProcessInstaller] No automatic restoration was attempted. Use the reported backup manually if one was created.');
    process.exitCode = 1;
  });
}

module.exports = {
  configureStartup,
  createPackageBackup,
  discoverComponents,
  discoverPackageFiles
};
