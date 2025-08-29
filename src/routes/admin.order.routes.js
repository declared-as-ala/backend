import { Router } from 'express';
import { requireAdmin, requireRole } from '../middleware/authAdmin.js';
import {
  listOrders,
  updateOrderStatus,
  exportOrdersCSV,
} from '../controllers/admin.order.controller.js';

const router = Router();
router.get(
  '/',
  requireAdmin,
  requireRole('admin', 'manager', 'staff'),
  listOrders
);
router.patch(
  '/:id/status',
  requireAdmin,
  requireRole('admin', 'manager'),
  updateOrderStatus
);
router.get(
  '/export/csv',
  requireAdmin,
  requireRole('admin', 'manager'),
  exportOrdersCSV
);

export default router;
