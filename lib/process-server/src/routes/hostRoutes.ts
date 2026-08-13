import { Router } from 'express';
import { hostController } from '../controllers/HostController';

const router = Router();

router.get('/unregistered', hostController.getUnregisteredServers);
router.post('/check-ports', hostController.checkPortsOccupied);

export default router;
