import jwt from 'jsonwebtoken';

export const customerAuth = (req, res, next) => {
  try {
    console.log('🔹 Headers:', req.headers);

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No authorization header or invalid format');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    console.log('🔹 JWT token:', token);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔑 JWT decoded:', decoded);

    req.customer = {
      id: decoded.id,
      email: decoded.email,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
    };

    console.log('✅ req.customer set:', req.customer);

    next();
  } catch (err) {
    console.error('❌ JWT error:', err);
    return res.status(401).json({ message: 'Token expired or invalid' });
  }
};
