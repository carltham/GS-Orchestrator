#!/usr/bin/env node

/**
 * GS-Orchestrator Client Generator
 * Inspects target project structure and dynamically generates a custom startupHandler.js
 */

const fs = require('fs');
const path = require('path');

function searchProjectFiles(targetDir, depth = 0) {
  let result = {
    orchestratorPath: null,
    backendPath: null,
    backendType: null,
    frontendDir: null,
    frontendType: null,
    dockerDir: null,
  };

  if (depth > 4) return result;

  try {
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });

    // Check for docker compose
    if (fs.existsSync(path.join(targetDir, 'docker-compose.yml'))) {
      result.dockerDir = targetDir;
      result.dockerFile = 'docker-compose.yml';
    } else if (fs.existsSync(path.join(targetDir, 'docker-compose.yaml'))) {
      result.dockerDir = targetDir;
      result.dockerFile = 'docker-compose.yaml';
    } else if (fs.existsSync(path.join(targetDir, 'docker-compose.dev.yml'))) {
      result.dockerDir = targetDir;
      result.dockerFile = 'docker-compose.dev.yml';
    }

    // Check for Orchestrator server
    if (fs.existsSync(path.join(targetDir, 'GS-Orchestrator', 'src', 'server.ts'))) {
      result.orchestratorPath = path.join(targetDir, 'GS-Orchestrator', 'src', 'server.ts');
    }

    // Check for Backend server
    if (fs.existsSync(path.join(targetDir, 'src', 'server.ts'))) {
      result.backendPath = path.join(targetDir, 'src', 'server.ts');
      result.backendType = 'ts';
    } else if (fs.existsSync(path.join(targetDir, 'src', 'index.ts'))) {
      result.backendPath = path.join(targetDir, 'src', 'index.ts');
      result.backendType = 'ts';
    } else if (fs.existsSync(path.join(targetDir, 'src', 'server.js'))) {
      result.backendPath = path.join(targetDir, 'src', 'server.js');
      result.backendType = 'js';
    } else if (fs.existsSync(path.join(targetDir, 'src', 'index.js'))) {
      result.backendPath = path.join(targetDir, 'src', 'index.js');
      result.backendType = 'js';
    } else if (fs.existsSync(path.join(targetDir, 'dist', 'server.js'))) {
      result.backendPath = path.join(targetDir, 'dist', 'server.js');
      result.backendType = 'js';
    } else if (fs.existsSync(path.join(targetDir, 'dist', 'index.js'))) {
      result.backendPath = path.join(targetDir, 'dist', 'index.js');
      result.backendType = 'js';
    }

    // Check for Frontend
    if (fs.existsSync(path.join(targetDir, 'angular.json'))) {
      result.frontendDir = targetDir;
      result.frontendType = 'angular';
    } else if (fs.existsSync(path.join(targetDir, 'vite.config.ts')) || fs.existsSync(path.join(targetDir, 'vite.config.js'))) {
      result.frontendDir = targetDir;
      result.frontendType = 'vite';
    }

    // Recursively check subdirectories
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        entry.name !== 'node_modules' &&
        entry.name !== 'dist' &&
        entry.name !== 'coverage' &&
        entry.name !== '_archived' &&
        entry.name !== 'playwright-report' &&
        entry.name !== 'test-results'
      ) {
        const subPath = path.join(targetDir, entry.name);
        const subResult = searchProjectFiles(subPath, depth + 1);

        if (!result.orchestratorPath && subResult.orchestratorPath) result.orchestratorPath = subResult.orchestratorPath;
        if (!result.backendPath && subResult.backendPath) {
          result.backendPath = subResult.backendPath;
          result.backendType = subResult.backendType;
        }
        if (!result.frontendDir && subResult.frontendDir) {
          result.frontendDir = subResult.frontendDir;
          result.frontendType = subResult.frontendType;
        }
        if (!result.dockerDir && subResult.dockerDir) {
          result.dockerDir = subResult.dockerDir;
          result.dockerFile = subResult.dockerFile;
        }
      }
    }
  } catch (e) {}

  return result;
}

function generateStartupHandler(targetDir) {
  console.log(`🔍 Inspecting project at ${targetDir}...`);

  const detected = searchProjectFiles(targetDir);

  let pkgName = path.basename(targetDir);
  const pkgPath = path.join(targetDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) pkgName = pkg.name;
    } catch (e) {
      // ignore
    }
  }

  const codeBlocks = [];
  const procTrackers = [];

  // 1. Database Check (Start container first so DB is ready)
  if (detected.dockerDir) {
    const relPath = path.relative(targetDir, detected.dockerDir).split(path.sep);
    const dockerCwd = relPath.length > 0 && relPath[0] !== '' ? `path.join(__dirname, ${relPath.map((p) => `'${p}'`).join(', ')})` : '__dirname';
    const dockerFileArg = detected.dockerFile && detected.dockerFile !== 'docker-compose.yml' ? `, '-f', '${detected.dockerFile}'` : '';
    codeBlocks.push(`
  // Database Service (Docker Compose)
  console.log('⏳ Starting Database container (docker compose up)...');
  const dbProc = spawn('docker', ['compose'${dockerFileArg}, 'up', '-d', 'postgres'], {
    cwd: ${dockerCwd},
    stdio: 'inherit',
    shell: true,
  });
  console.log('✅ Database container command executed.');`);
  }

  // 2. GS-Orchestrator Self Check
  if (detected.orchestratorPath) {
    const relPath = path.relative(targetDir, detected.orchestratorPath).split(path.sep);
    procTrackers.push('orchestratorProc');
    codeBlocks.push(`
  // GS-Orchestrator Server
  const orchestratorPath = path.join(__dirname, ${relPath.map((p) => `'${p}'`).join(', ')});
  const configDir = path.join(__dirname, 'config');
  console.log('⏳ Starting GS-Orchestrator server on port 9000...');
  const orchestratorProc = spawn('npx', ['--yes', 'ts-node', orchestratorPath], {
    cwd: path.dirname(orchestratorPath),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, GSSHOPPER_CONFIG_DIR: configDir },
  });
  processes.push(orchestratorProc);
  console.log('✅ GS-Orchestrator server spawned.');`);
  } else if (detected.backendPath) {
    const relPath = path.relative(targetDir, detected.backendPath).split(path.sep);
    procTrackers.push('backendProc');
    if (detected.backendType === 'ts') {
      codeBlocks.push(`
  // Backend Service (TypeScript)
  const backendPath = path.join(__dirname, ${relPath.map((p) => `'${p}'`).join(', ')});
  const configDir = path.join(__dirname, 'config');
  console.log('⏳ Starting Backend service (ts-node)...');
  const backendProc = spawn('npx', ['--yes', 'ts-node', backendPath], {
    cwd: path.dirname(backendPath),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, GSSHOPPER_CONFIG_DIR: configDir },
  });
  processes.push(backendProc);
  console.log('✅ Backend process spawned.');`);
    } else {
      codeBlocks.push(`
  // Backend Service (JavaScript)
  const backendPath = path.join(__dirname, ${relPath.map((p) => `'${p}'`).join(', ')});
  const configDir = path.join(__dirname, 'config');
  console.log('⏳ Starting Backend service (node)...');
  const backendProc = spawn('node', [backendPath], {
    cwd: path.dirname(backendPath),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, GSSHOPPER_CONFIG_DIR: configDir },
  });
  processes.push(backendProc);
  console.log('✅ Backend process spawned.');`);
    }
  }

  // 3. Frontend Check
  if (detected.frontendDir) {
    const relPath = path.relative(targetDir, detected.frontendDir).split(path.sep);
    const frontendCwd = relPath.length > 0 && relPath[0] !== '' ? `path.join(__dirname, ${relPath.map((p) => `'${p}'`).join(', ')})` : '__dirname';
    const frameworkName = detected.frontendType === 'angular' ? 'Angular frontend (npm run dev)' : 'Vite frontend (npm run dev)';
    procTrackers.push('frontendProc');

    codeBlocks.push(`
  // Frontend Service (${detected.frontendType})
  console.log('⏳ Starting ${frameworkName}...');
  const frontendProc = spawn('npm', ['run', 'dev'], {
    cwd: ${frontendCwd},
    stdio: 'inherit',
    shell: true,
  });
  processes.push(frontendProc);
  console.log('✅ Frontend process spawned.');`);
  }

  if (codeBlocks.length === 0) {
    codeBlocks.push(`
  console.warn('⚠️ No default components detected for ${pkgName}. Edit startupHandler.js to specify start commands.');`);
  }

  const handlerContent = `const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Auto-generated Startup Handler for ${pkgName}
 * Generated by @gs/orchestrator-client
 */
function main() {
  console.log('🚀 [startupHandler] Starting services for ${pkgName}...');
  const processes = [];

  const cleanup = () => {
    console.log('\\n🛑 [startupHandler] Shutting down spawned services...');
    processes.forEach((p) => {
      try { p.kill('SIGTERM'); } catch (e) {}
    });
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
${codeBlocks.join('\n')}
}

main();
`;

  const outputPath = path.join(targetDir, 'startupHandler.js');
  fs.writeFileSync(outputPath, handlerContent, 'utf-8');
  console.log(`✅ Generated tailored startupHandler.js at ${outputPath}`);

  // Update target package.json
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      pkg.scripts = pkg.scripts || {};
      pkg.scripts['start'] = 'node node_modules/@gs/orchestrator-client/dist/index.js || node startupHandler.js';
      pkg.scripts['startupHandler'] = 'node startupHandler.js';
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf-8');
      console.log(`✅ Configured "start" script in ${pkgPath}`);
    } catch (e) {
      console.error('Failed to update package.json:', e);
    }
  }
}

// Execute when run directly as CLI
if (require.main === module) {
  const targetDir = process.cwd();
  generateStartupHandler(targetDir);
}

module.exports = { generateStartupHandler, searchProjectFiles };
