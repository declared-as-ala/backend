import { Router } from 'express';
import {
  adminLogin,
  adminRefresh,
  me,
} from '../controllers/admin.auth.controller.js';
import { requireAdmin } from '../middleware/authAdmin.js';

const router = Router();

router.post('/login', adminLogin);
router.post('/refresh', adminRefresh);
router.get('/me', requireAdmin, me);

export default router;
