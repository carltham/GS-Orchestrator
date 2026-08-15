import * as net from 'net';
import * as child_process from 'child_process';

export interface LocalPortProbeResult {
  port: number;
  isAvailable: boolean;
  occupiedBy?: string;
}

/**
 * Probes a local TCP port on the current machine.
 * Detects whether the port is open/listening locally (including Docker proxy or native daemons).
 */
export async function isLocalPortOccupied(port: number): Promise<boolean> {
  // Method 1: Try binding a local server to test availability
  const checkBind = (): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.unref();

      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true); // Port occupied
        } else {
          resolve(true);
        }
      });

      server.once('listening', () => {
        server.close(() => {
          resolve(false); // Port free
        });
      });

      server.listen(port);
    });
  };

  const occupiedViaBind = await checkBind();
  if (occupiedViaBind) return true;

  // Method 2: Fast OS socket check if on Linux/Unix (catches docker-proxy and lingering bindings)
  try {
    const output = child_process.execSync(`ss -tlnH sport = :${port} 2>/dev/null || true`, { encoding: 'utf8' }).trim();
    if (output.length > 0) return true;
  } catch {}

  return false;
}

/**
 * Batch checks candidate ports and returns occupied statuses.
 */
export async function probeCandidatePorts(ports: Record<string, number>): Promise<Record<string, LocalPortProbeResult>> {
  const results: Record<string, LocalPortProbeResult> = {};

  for (const [serviceKey, port] of Object.entries(ports)) {
    const isOccupied = await isLocalPortOccupied(port);
    results[serviceKey] = {
      port,
      isAvailable: !isOccupied,
      occupiedBy: isOccupied ? 'host-daemon/docker' : undefined
    };
  }

  return results;
}
