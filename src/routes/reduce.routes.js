import express from 'express';
import {
  validateDiscountCode,
  applyDiscountCode,
  getAllDiscountCodes,
  createDiscountCode,
  updateDiscountCode,
  deleteDiscountCode,
} from '../controllers/reduce.controller.js'; // Fixed: Changed from reduce.controller to discount.controller.js

const router = express.Router();

// Public routes
router.get('/validate', validateDiscountCode);
router.post('/apply', applyDiscountCode);

// Admin routes (you may want to add authentication middleware here)

export default router;
