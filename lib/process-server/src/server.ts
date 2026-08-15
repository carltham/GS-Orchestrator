import express, { Request, Response } from 'express';
import cors from 'cors';
import routes from './routes';

import { projectRegistry } from './models/ProjectRegistry';
import { pureServerScanner } from './services/ServerScannerService';

const PORT = process.env.PROCESS_SERVER_PORT ? parseInt(process.env.PROCESS_SERVER_PORT, 10) : 9999;

const app = express();

app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    server: 'ProcessServer',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Load all MVC Routes
app.use(routes);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[ProcessServer] Running on fixed port ${PORT}`);
  });
}

export { app, PORT, projectRegistry, pureServerScanner };
export default app;
