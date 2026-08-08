import * as fs from 'fs';
import * as path from 'path';

export function detectOwnProjectName(): string {
  try {
    let currentDir = __dirname;
    while (currentDir !== path.parse(currentDir).root) {
      if (path.basename(currentDir) === 'GS-Orchestrator' || path.basename(currentDir) === 'gs-orchestrator') {
        return path.basename(currentDir);
      }
      if (fs.existsSync(path.join(currentDir, '.git'))) {
        return path.basename(currentDir);
      }
      currentDir = path.dirname(currentDir);
    }
  } catch (err) {
    // Fallback
  }
  return 'GS-Orchestrator';
}
