import { Router } from 'express';
import { projectController } from '../controllers/ProjectController';

const router = Router();

router.post('/register', projectController.registerProject);
router.get('/list', projectController.getProjects);
router.get('/:name', projectController.getProject);
router.delete('/:name', projectController.unregisterProject);

export default router;
