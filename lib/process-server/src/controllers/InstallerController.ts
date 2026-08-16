import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { generateProcessAdapter, InspectionPayload } from '../generators/adapterGenerator';

export class InstallerController {
  // GET /install.sh
  public getInstallSh(req: Request, res: Response): void {
    const scriptPath = path.resolve(__dirname, '..', 'templates', 'install.sh');
    if (fs.existsSync(scriptPath)) {
      res.setHeader('Content-Type', 'text/x-shellscript');
      res.sendFile(scriptPath);
    } else {
      res.status(404).send('# Error: install.sh template not found');
    }
  }

  // GET /install.js
  public getInstallJs(req: Request, res: Response): void {
    const scriptPath = path.resolve(__dirname, '..', 'templates', 'install.js');
    if (fs.existsSync(scriptPath)) {
      res.setHeader('Content-Type', 'application/javascript');
      res.sendFile(scriptPath);
    } else {
      res.status(404).send('// Error: install.js template not found');
    }
  }

  // GET /install/instructions
  public getInstructions(req: Request, res: Response): void {
    // Look in docs/ first (canonical source), with fallback to template/dist paths
    const candidates = [
      path.resolve(process.cwd(), 'docs', 'CLIENT_INSTALLATION.md'),
      path.resolve(__dirname, '..', '..', '..', '..', 'docs', 'CLIENT_INSTALLATION.md'),
      path.resolve(__dirname, '..', 'templates', 'CLIENT_INSTALLATION.md')
    ];

    const docPath = candidates.find(p => fs.existsSync(p));

    if (docPath) {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.sendFile(docPath);
    } else {
      res.status(404).send('# Error: CLIENT_INSTALLATION.md not found');
    }
  }

  // GET /packages/process-client.tgz
  public getProcessClientTarball(req: Request, res: Response): void {
    try {
      const clientPkgDir = path.resolve(__dirname, '..', '..', '..', 'process-client');
      // If run inside compilation folders, secure correct path matching
      const targetDir = fs.existsSync(clientPkgDir) 
        ? clientPkgDir 
        : path.resolve(__dirname, '..', '..', 'process-client');

      const tmpDir = path.join(os.tmpdir(), 'gs-process-client-pack');

      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      const output = execSync(`npm pack --ignore-scripts --pack-destination "${tmpDir}"`, {
        cwd: targetDir,
        encoding: 'utf8'
      }).trim();

      const packedFileName = output.split('\n').pop()?.trim() || 'gs-orchestrator-1.0.0.tgz';
      const packedFilePath = path.join(tmpDir, packedFileName);

      if (fs.existsSync(packedFilePath)) {
        res.setHeader('Content-Type', 'application/gzip');
        res.sendFile(packedFilePath);
      } else {
        res.status(500).send('Error: Dynamic packaging failed to produce tarball');
      }
    } catch (err: any) {
      console.error('[ProcessServer:InstallerController] Dynamic pack error:', err.message);
      res.status(500).send(`Error generating client tarball: ${err.message}`);
    }
  }

  // POST /ps/installer/generate
  public generateAdapter(req: Request, res: Response): void {
    const payload: InspectionPayload = req.body || {};
    if (!payload.projectName || !Array.isArray(payload.components) || payload.components.length === 0) {
      res.status(400).json({ error: 'projectName and at least one discovered component are required' });
      return;
    }
    const invalidComponent = payload.components.find((component) =>
      !component.name
      || !['backend', 'frontend', 'database', 'service'].includes(component.serviceType)
      || !component.command?.executable
      || !Array.isArray(component.command.args)
      || path.isAbsolute(component.relativePath)
      || component.relativePath.split(/[\\/]/).includes('..')
    );
    if (invalidComponent) {
      res.status(400).json({ error: 'A discovered component has an invalid command or relative path' });
      return;
    }
    const adapterCode = generateProcessAdapter(payload);

    res.setHeader('Content-Type', 'application/javascript');
    res.status(200).send(adapterCode);
  }
}

export const installerController = new InstallerController();
