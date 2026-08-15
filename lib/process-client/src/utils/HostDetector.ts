import * as os from 'os';

export interface HostInfo {
  hostname: string;
  domain?: string;
  platform: string;
  ipAddresses: string[];
}

export function detectHostInfo(): HostInfo {
  const hostname = os.hostname() || 'localhost';
  let domain = '';

  // Attempt resolving domain or FQDN if available
  try {
    const parts = hostname.split('.');
    if (parts.length > 1) {
      domain = parts.slice(1).join('.');
    }
  } catch {}

  const networkInterfaces = os.networkInterfaces();
  const ipAddresses: string[] = [];

  for (const interfaceKey of Object.keys(networkInterfaces)) {
    const ifaceList = networkInterfaces[interfaceKey];
    if (ifaceList) {
      for (const iface of ifaceList) {
        if (!iface.internal && iface.family === 'IPv4') {
          ipAddresses.push(iface.address);
        }
      }
    }
  }

  return {
    hostname,
    domain: domain || undefined,
    platform: os.platform(),
    ipAddresses
  };
}
