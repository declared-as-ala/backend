import AdminUser from '../models/AdminUser.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefresh,
} from '../utils/jwt.js';

export async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await AdminUser.findOne({ email, active: true });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    res.json({ user: payload, accessToken, refreshToken });
  } catch (e) {
    next(e);
  }
}

export async function adminRefresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(400).json({ message: 'Missing refreshToken' });
    const payload = verifyRefresh(refreshToken);
    const { id, email, role, name } = payload;
    const accessToken = signAccessToken({ id, email, role, name });
    res.json({ accessToken });
  } catch (e) {
    next(e);
  }
}

export async function me(req, res) {
  // Prevent caching
  res.set('Cache-Control', 'no-store');
  res.json({ user: req.admin }); // return `user` instead of `admin`
}
