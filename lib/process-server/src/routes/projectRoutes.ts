import { Router } from 'express';
import { projectController } from '../controllers/ProjectController';

const router = Router();

router.post('/register', projectController.registerProject);
router.get('/list', projectController.getProjects);
router.get('/:name', projectController.getProject);
router.put('/:name/status', projectController.updateProjectStatus);
router.delete('/:name', projectController.unregisterProject);

export default router;
