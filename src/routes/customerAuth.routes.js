import { Router } from 'express';
import {
  register,
  login,
  refresh,
  me,
  updateProfile,
  forgotPassword,
} from '../controllers/customerAuth.controller.js';
import { customerAuth } from '../middleware/customerAuth.js';

const r = Router();

r.post('/auth/register', register);
r.post('/auth/login', login);
r.post('/auth/refresh', refresh);
r.get('/auth/me', customerAuth, me);
r.put('/profile', customerAuth, updateProfile);
r.post('/auth/forgot', forgotPassword);

export default r;
