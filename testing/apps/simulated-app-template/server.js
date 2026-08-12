const express = require('express');
const app = express();

// Retrieve port dynamically from system environment variables (allocated by Orchestrator)
const PORT = process.env.PORT || process.env.backend || 3000;

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

const server = app.listen(PORT, () => {
  console.log(`[SIMULATED APP] Running on dynamic allocated port: ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('[SIMULATED APP] Received SIGTERM, taking server offline cleanly.');
  server.close(() => {
    process.exit(0);
  });
});
