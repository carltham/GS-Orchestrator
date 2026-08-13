import express, { Request, Response } from 'express';
import cors from 'cors';
import routes from './routes';

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

export default app;
