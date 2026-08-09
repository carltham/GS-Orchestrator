#!/usr/bin/env node

/**
 * Node.js Cross-Platform Installer for @gs/orchestrator-client
 * Usage: node install-client.js /path/to/target-project
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

let clientDir = path.resolve(__dirname);
if (!fs.existsSync(path.join(clientDir, 'package.json'))) {
  clientDir = '/mnt/DATA/Projects/0.present-projects/Active/GS-Orchestrator/lib/orchestrator-client';
}
const targetArg = process.argv[2] && process.argv[2] !== '-' ? process.argv[2] : '.';
const targetDir = path.resolve(targetArg);

if (!fs.existsSync(path.join(targetDir, 'package.json'))) {
  const projectName = path.basename(targetDir);
  console.log(`📄 Creating package.json for '${projectName}'...`);
  execSync('npm init -y', { cwd: targetDir, stdio: 'ignore' });
}

console.log('📦 Building @gs/orchestrator-client...');
execSync('npm run build', { cwd: clientDir, stdio: 'inherit' });

console.log(`🔗 Installing @gs/orchestrator-client into '${targetDir}'...`);
execSync(`npm install "file:${clientDir}"`, { cwd: targetDir, stdio: 'inherit' });

console.log(`🛠️ Generating tailored startupHandler.js for '${targetDir}'...`);
execSync('npx orchestrator-init', { cwd: targetDir, stdio: 'inherit' });

console.log('✨ Installation complete! @gs/orchestrator-client and startupHandler.js are ready.');
console.log('🚀 To run the application, execute: npm start (or node startupHandler.js)');
