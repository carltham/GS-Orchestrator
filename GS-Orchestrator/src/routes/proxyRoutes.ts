import http from 'http';
import * as crypto from 'crypto';
import { Request, Response, Router } from 'express';

const PROCESS_SERVER_URL = process.env.PROCESS_SERVER_URL || 'http://localhost:9999';

/**
 * Clean reverse proxy from Orchestrator (/orch/* or /ps/*) directly to ProcessServer (:9999)
 */
export function createProxyRoutes(): Router {
  const router = Router();
  const psUrl = new URL(PROCESS_SERVER_URL);

  const forwardToProcessServer = (
    targetPath: string,
    req: Request,
    res: Response,
    attempt = 0,
    method: string = req.method
  ) => {
    const options: http.RequestOptions = {
      hostname: psUrl.hostname,
      port: psUrl.port || 9999,
      path: targetPath + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''),
      method,
      headers: {
        ...req.headers,
        host: `${psUrl.hostname}:${psUrl.port || 9999}`
      }
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.setTimeout(5000, () => {
      proxyReq.destroy(new Error('ProcessServer request timed out'));
    });

    proxyReq.on('error', (err) => {
      if (attempt < 1 && !res.headersSent) {
        forwardToProcessServer(targetPath, req, res, attempt + 1, method);
        return;
      }
      console.error(`[Orchestrator:Proxy] Failed forwarding ${req.method} ${targetPath}:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Bad Gateway: ProcessServer unreachable',
          details: err.message,
          target: targetPath
        });
      }
    });

    if (req.body && Object.keys(req.body).length > 0 && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const bodyData = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }

    proxyReq.end();
  };

  // 1. Direct /ps/* proxy
  router.all('/ps/*', (req: Request, res: Response) => {
    forwardToProcessServer(req.path, req, res);
  });

  // 2. /orch/project/registry -> /ps/project/list
  router.get('/orch/project/registry', (req: Request, res: Response) => {
    forwardToProcessServer('/ps/project/list', req, res);
  });

  // 3. /orch/project/count -> /ps/project/list (or custom count mapping)
  router.get('/orch/project/count', (req: Request, res: Response) => {
    const options: http.RequestOptions = {
      hostname: psUrl.hostname,
      port: psUrl.port || 9999,
      path: '/ps/project/list',
      method: 'GET',
      headers: { ...req.headers, host: `${psUrl.hostname}:${psUrl.port || 9999}` }
    };

    const proxyReq = http.request(options, (proxyRes) => {
      let data = '';
      proxyRes.on('data', chunk => data += chunk);
      proxyRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const count = parsed.projects ? Object.keys(parsed.projects).length : 0;
          res.json({ count });
        } catch {
          res.json({ count: 0 });
        }
      });
    });

    proxyReq.on('error', (err) => {
      res.status(502).json({ error: 'ProcessServer unreachable', count: 0 });
    });

    proxyReq.end();
  });

  // 4. /orch/project/register -> /ps/project/register
  router.post('/orch/project/register', (req: Request, res: Response) => {
    forwardToProcessServer('/ps/project/register', req, res);
  });

  // 5. /orch/reporting/project/health -> /ps/process/heartbeat
  router.post('/orch/reporting/project/health', (req: Request, res: Response) => {
    forwardToProcessServer('/ps/process/heartbeat', req, res);
  });

  // 6. /orch/project/unregistered -> /ps/host/unregistered
  router.get('/orch/project/unregistered', (req: Request, res: Response) => {
    forwardToProcessServer('/ps/host/unregistered', req, res);
  });

  // 7. /orch/project/:name/start -> POST /ps/process/signals (action: START)
  router.post('/orch/project/:name/start', (req: Request, res: Response) => {
    const projectName = req.params.name;
    req.body = {
      targetProject: projectName,
      action: 'START',
      idempotencyKey: req.get('Idempotency-Key') || crypto.randomUUID()
    };
    forwardToProcessServer('/ps/process/signals', req, res);
  });

  // 8. /orch/project/:name/stop -> POST /ps/process/signals (action: STOP)
  router.post('/orch/project/:name/stop', (req: Request, res: Response) => {
    const projectName = req.params.name;
    req.body = {
      targetProject: projectName,
      action: 'STOP',
      idempotencyKey: req.get('Idempotency-Key') || crypto.randomUUID()
    };
    forwardToProcessServer('/ps/process/signals', req, res);
  });

  // 9. /orch/project/:name/restart -> POST /ps/process/signals (action: START)
  router.post('/orch/project/:name/restart', (req: Request, res: Response) => {
    const projectName = req.params.name;
    req.body = {
      targetProject: projectName,
      action: 'START',
      idempotencyKey: req.get('Idempotency-Key') || crypto.randomUUID()
    };
    forwardToProcessServer('/ps/process/signals', req, res);
  });

  // 10. DELETE /orch/project/:name -> queue DELETE for the owning client
  router.delete('/orch/project/:name', (req: Request, res: Response) => {
    const projectName = req.params.name;
    req.body = {
      targetProject: projectName,
      action: 'DELETE',
      idempotencyKey: req.get('Idempotency-Key') || crypto.randomUUID()
    };
    forwardToProcessServer('/ps/process/signals', req, res, 0, 'POST');
  });

  return router;
}
