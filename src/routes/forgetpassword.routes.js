import express from 'express';
import {
  sendResetCode,
  resetPassword,
} from '../controllers/forgotPassword.controller';
const router = express.Router();

// Send OTP code to email
router.post('/auth/forgot-password', sendResetCode);

// Verify code & reset password
router.post('/auth/reset-password', resetPassword);

export default router;
