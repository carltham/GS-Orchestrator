const http = require('http');

// Dynamic port selection via environment keys given by Orchestrator
const PORT = process.env.PORT || process.env.frontend || 4200;
const BACKEND_PORT = process.env.backend || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/ps/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', type: 'frontend', uptime: process.uptime() }));
    return;
  }

  // Basic HTML presentation representation
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Simulated Frontend Template</title>
      <style>body { font-family: sans-serif; text-align: center; margin-top: 50px; background: #e0f2fe; }</style>
    </head>
    <body>
      <h1>Simulated Frontend Template</h1>
      <p>Configured backend port: <strong>${BACKEND_PORT}</strong></p>
      <div id="status">Connecting backend...</div>
      <script>
        fetch('http://localhost:${BACKEND_PORT}/api/items')
          .then(res => res.json())
          .then(data => {
            document.getElementById('status').innerText = 'Connected! Database contains ' + data.length + ' item(s).';
          })
          .catch(() => {
            document.getElementById('status').innerText = 'Backend offline';
          });
      </script>
    </body>
    </html>
  `);
});

server.listen(PORT, () => {
  console.log(`[FRONTEND] Running on dynamic allocated port: ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('[FRONTEND] Received SIGTERM, shutdown cleanly.');
  server.close(() => {
    process.exit(0);
  });
});
