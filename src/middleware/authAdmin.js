import { verifyAccess } from '../utils/jwt.js';

export function requireAdmin(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Missing token' });
  try {
    const decoded = verifyAccess(token);
    req.admin = decoded; // { id, role, email }
    return next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid/expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}
