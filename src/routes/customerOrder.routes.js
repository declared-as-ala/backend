import { Router } from 'express';
import {
  getMyOrders,
  getAllOrders,
  getOrderById,
} from '../controllers/customerOrder.controller.js';
import { customerAuth } from '../middleware/customerAuth.js';
const router = Router();

router.get('/my', customerAuth, getMyOrders);
router.get('/', getAllOrders);
router.get('/:id', customerAuth, getOrderById); // admin or order owner

export default router;
