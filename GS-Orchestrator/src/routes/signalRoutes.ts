import { Router } from 'express';
import { signalService } from '../services/SignalService';

const router = Router();

/**
 * GET /api/signals/:projectName
 * Get pending signals for a project
 */
router.get('/:projectName', (req, res) => {
  const { projectName } = req.params;
  const signals = signalService.getSignalsForProject(projectName);
  res.json({ projectName, signals });
});

/**
 * POST /api/signals/:projectName/ack
 * Mark signals as processed for a project
 */
router.post('/:projectName/ack', (req, res) => {
  const { projectName } = req.params;
  signalService.markSignalsProcessed(projectName);
  res.json({ success: true, projectName, message: 'Signals marked as processed' });
});

export default router;
