import jwt from 'jsonwebtoken';

export function signAccessToken(payload) {
  // Short-lived token (15 min recommended, can be longer)
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || '30d',
  });
}

export function signRefreshToken(payload) {
  // Long-lived token (30 days recommended)
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '30d',
  });
}

export function verifyAccess(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

export function verifyRefresh(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}
