import { Router } from 'express';
import { installerController } from '../controllers/InstallerController';

const router = Router();

router.get('/install.sh', installerController.getInstallSh);
router.get('/install.js', installerController.getInstallJs);
router.get('/install/instructions', installerController.getInstructions);
router.get('/packages/process-client.tgz', installerController.getProcessClientTarball);
router.post('/ps/installer/generate', installerController.generateAdapter);

export default router;
