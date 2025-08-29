// middleware/paypal.middleware.js (Minimal - No IPv6 Issues)
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { logger } from '../utils/logger.js';

/**
 * Basic rate limiting for PayPal endpoints - NO custom keyGenerator
 */
export const rateLimitPayPal = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  
  message: {
    error: 'Too many PayPal requests from this IP, please try again later.'
  },
  
  standardHeaders: true,
  legacyHeaders: false,
  
  skip: (req) => {
    const skipPaths = ['/return', '/cancel', '/webhook'];
    return skipPaths.some(path => req.path.includes(path));
  }
});

/**
 * Development rate limiter - more lenient
 */
export const rateLimitPayPalDev = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // More requests allowed in development
  
  skip: (req) => {
    const skipPaths = ['/return', '/cancel', '/webhook', '/order-status'];
    return skipPaths.some(path => req.path.includes(path));
  },
  
  message: {
    error: 'Rate limit exceeded (development mode)',
    note: 'This is more lenient in development'
  }
});

/**
 * Phone number validation helper
 */
const validatePhoneNumber = (phone) => {
  const cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
  
  if (cleaned.startsWith('+')) {
    const withoutPlus = cleaned.substring(1);
    if (!/^\d+$/.test(withoutPlus)) {
      return false;
    }
    return withoutPlus.length >= 7 && withoutPlus.length <= 15;
  }
  
  if (cleaned.startsWith('0')) {
    return /^0\d{9}$/.test(cleaned);
  }
  
  if (/^\d+$/.test(cleaned)) {
    return cleaned.length >= 8 && cleaned.length <= 15;
  }
  
  return false;
};

/**
 * Validation middleware for PayPal order creation
 */
export const validatePayPalOrder = [
  body('amount')
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage('Amount must be between 0.01 and 10,000'),
  
  body('currency')
    .optional()
    .isIn(['EUR', 'USD', 'GBP', 'CAD'])
    .withMessage('Invalid currency code'),
  
  body('customer.fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Customer name must be between 2 and 100 characters'),
  
  body('customer.email')
    .isEmail()
    .withMessage('Valid email is required'),
  
  body('customer.phone')
    .custom((value) => {
      if (!validatePhoneNumber(value)) {
        throw new Error('Phone number format is invalid');
      }
      return true;
    }),
  
  body('items')
    .isArray({ min: 1, max: 50 })
    .withMessage('Between 1 and 50 items are required'),
  
  body('items.*.name')
    .trim()
    .isLength({ min: 1, max: 127 })
    .withMessage('Item name is required'),
  
  body('items.*.price')
    .isFloat({ min: 0.01, max: 1000 })
    .withMessage('Item price must be between 0.01 and 1,000'),
  
  body('items.*.quantity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Item quantity must be between 1 and 100'),
  
  body('pickupType')
    .isIn(['store', 'delivery'])
    .withMessage('Pickup type must be either store or delivery'),
  
  // Validation result handler
  (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Please check your input data',
        details: errors.array()
      });
    }
    
    next();
  }
];

/**
 * Security middleware for PayPal endpoints
 */
export const securePayPalEndpoint = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  logger.info('PayPal endpoint accessed:', {
    ip: req.ip,
    method: req.method,
    path: req.path
  });
  
  next();
};