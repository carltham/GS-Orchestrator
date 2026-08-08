#!/usr/bin/env node

/**
 * Node.js Cross-Platform Installer for @gs/orchestrator-client
 * Usage: node install-client.js /path/to/target-project
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const clientDir = path.resolve(__dirname);
const targetArg = process.argv[2] || '.';
const targetDir = path.resolve(targetArg);

if (!fs.existsSync(path.join(targetDir, 'package.json'))) {
  console.error(`❌ Error: Target directory '${targetDir}' does not contain a package.json file.`);
  process.exit(1);
}

console.log('📦 Building @gs/orchestrator-client...');
execSync('npm run build', { cwd: clientDir, stdio: 'inherit' });

console.log(`🔗 Installing @gs/orchestrator-client into '${targetDir}'...`);
execSync(`npm install "file:${clientDir}"`, { cwd: targetDir, stdio: 'inherit' });

console.log(`🛠️ Generating tailored startupHandler.js for '${targetDir}'...`);
const { generateStartupHandler } = require('./bin/init.js');
generateStartupHandler(targetDir);

console.log('✨ Installation complete! @gs/orchestrator-client and startupHandler.js are ready.');
