import { Request, Response } from 'express';
import { pureServerScanner } from '../services/ServerScannerService';

export class HostController {
  // GET /ps/host/unregistered
  public async getUnregisteredServers(req: Request, res: Response): Promise<void> {
    try {
      const registeredPortsQuery = (req.query.registeredPorts as string) || '';
      const registeredPathsQuery = (req.query.registeredPaths as string) || '';

      const registeredPorts = registeredPortsQuery 
        ? registeredPortsQuery.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p)) 
        : [];
      const registeredPaths = registeredPathsQuery 
        ? registeredPathsQuery.split(',') 
        : [];

      const servers = await pureServerScanner.scanRunningServers(registeredPorts, registeredPaths);
      res.json({
        lastScanned: new Date().toISOString(),
        servers
      });
    } catch (err: any) {
      console.error('[ProcessServer:HostController] Scanner execution failed:', err.message);
      res.status(500).json({ 
        error: 'Scanner execution failed', 
        details: err instanceof Error ? err.message : String(err) 
      });
    }
  }

  // POST /ps/host/check-ports
  public async checkPortsOccupied(req: Request, res: Response): Promise<any> {
    try {
      const { ports } = req.body || {};
      if (!Array.isArray(ports)) {
        return res.status(400).json({ error: 'ports query array is required' });
      }

      const results: Record<number, boolean> = {};
      for (const port of ports) {
        results[port] = await pureServerScanner.isPortOccupied(port);
      }
      res.json({ ports: results });
    } catch (err: any) {
      console.error('[ProcessServer:HostController] Port checking failed:', err.message);
      res.status(500).json({ 
        error: 'Port checking failed', 
        details: err instanceof Error ? err.message : String(err) 
      });
    }
  }
}

export const hostController = new HostController();
