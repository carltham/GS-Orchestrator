const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || process.env.database || 5433;
const DB_FILE = process.env.DB_FILE || path.join(process.cwd(), 'data', 'store.json');

const server = http.createServer((req, res) => {
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
    res.end(JSON.stringify({ status: 'ok', type: 'filedb', uptime: process.uptime() }));
    return;
  }

  if (req.url === '/records') {
    try {
      if (!fs.existsSync(DB_FILE)) {
        fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
        fs.writeFileSync(DB_FILE, JSON.stringify([
          { id: 1, name: 'Initial Seed Record A' },
          { id: 2, name: 'Initial Seed Record B' }
        ], null, 2));
      }

      if (req.method === 'GET') {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(raw);
        return;
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const newRecord = JSON.parse(body);
            const current = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            newRecord.id = current.length ? Math.max(...current.map(r => r.id)) + 1 : 1;
            current.push(newRecord);
            fs.writeFileSync(DB_FILE, JSON.stringify(current, null, 2));
            
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(newRecord));
          } catch (pErr) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON body: ' + pErr.message }));
          }
        });
        return;
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Homegrown FileDB error: ' + err.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  console.log(`[FILEDB] Running on dynamic allocated port: ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('[FILEDB] Received SIGTERM, taking database offline cleanly.');
  server.close(() => {
    process.exit(0);
  });
});
