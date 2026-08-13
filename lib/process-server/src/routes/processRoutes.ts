import { Router } from 'express';
import { processController } from '../controllers/ProcessController';

const router = Router();

router.get('/signals', processController.getSignals);
router.post('/signals', processController.queueSignal);
router.post('/heartbeat', processController.updateHeartbeat);
router.get('/heartbeats', processController.getHeartbeats);

export default router;
