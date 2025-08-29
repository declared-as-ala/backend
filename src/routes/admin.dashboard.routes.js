import { Router } from 'express';
import { requireAdmin, requireRole } from '../middleware/authAdmin.js';
import { metrics } from '../controllers/admin.dashboard.controller.js';

const router = Router();
router.get('/metrics', requireAdmin, requireRole('admin', 'manager'), metrics);

export default router;
