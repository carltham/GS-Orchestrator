import http from 'http';

export function checkHttpHealth(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => resolve(res.statusCode === 200 || res.statusCode === 304));
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

export async function waitForService(url: string, timeoutMs: number = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkHttpHealth(url)) return true;
    await new Promise((res) => setTimeout(res, 1000));
  }
  return false;
}
