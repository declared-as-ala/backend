import express from 'express';
import {
  sendResetCode,
  resetPassword,
} from '../controllers/forgotPassword.controller.js';

const router = express.Router();

router.post('/auth/forgot-password', sendResetCode);
router.post('/auth/reset-password', resetPassword);

export default router;
