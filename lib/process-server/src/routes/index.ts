import { Router } from 'express';
import installerRoutes from './installerRoutes';
import processRoutes from './processRoutes';
import hostRoutes from './hostRoutes';
import projectRoutes from './projectRoutes';

const router = Router();

// Mount installer routes directly to mount points matching previous configurations
router.use('/', installerRoutes);

// Mount grouped routers
router.use('/ps/process', processRoutes);
router.use('/ps/host', hostRoutes);
router.use('/ps/project', projectRoutes);

export default router;
