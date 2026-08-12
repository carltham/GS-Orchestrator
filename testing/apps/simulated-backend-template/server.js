const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || process.env.backend || 3000;
// Port allocated to db microservice if existing, or local JSON filepath
const DATABASE_PORT = process.env.database || null;
const DATABASE_FILE = process.env.DATABASE_FILE || path.join(process.cwd(), 'data', 'db.json');

const server = http.createServer((req, res) => {
  // CORS configuration for local browser calls from frontend templates
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health' || req.url === '/ps/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', type: 'backend', uptime: process.uptime() }));
    return;
  }

  if (req.url === '/api/items') {
    if (DATABASE_PORT) {
      // Proxy to separate running FileDB template microservice
      const proxyReq = http.request(`http://localhost:${DATABASE_PORT}/records`, { method: 'GET' }, (proxyRes) => {
        let body = '';
        proxyRes.on('data', chunk => body += chunk);
        proxyRes.on('end', () => {
          res.writeHead(proxyRes.statusCode || 200, { 'Content-Type': 'application/json' });
          res.end(body);
        });
      });
      proxyReq.on('error', () => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to connect to microservice FileDB server' }));
      });
      proxyReq.end();
      return;
    }

    // Direct JSON file backup fallback
    try {
      if (!fs.existsSync(DATABASE_FILE)) {
        fs.mkdirSync(path.dirname(DATABASE_FILE), { recursive: true });
        fs.writeFileSync(DATABASE_FILE, JSON.stringify([]));
      }
      const data = fs.readFileSync(DATABASE_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed reading database file: ' + err.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  console.log(`[BACKEND] Running on dynamic allocated port: ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('[BACKEND] Received SIGTERM, shutdown cleanly.');
  server.close(() => {
    process.exit(0);
  });
});
