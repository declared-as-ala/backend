import { ValidationError } from './errors.js';

/**
 * Validate PayPal environment
 */
export function validatePayPalEnvironment(environment) {
  const validEnvironments = ['sandbox', 'live'];
  
  if (!environment || !validEnvironments.includes(environment)) {
    return 'sandbox'; // Default to sandbox
  }
  
  return environment;
}

/**
 * Sanitize PayPal data to prevent XSS and ensure proper types
 */
export function sanitizePayPalData(data) {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Invalid request data');
  }

  // Deep clone to avoid mutating original
  const sanitized = JSON.parse(JSON.stringify(data));

  // Sanitize strings
  function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    return str.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  // Sanitize customer data
  if (sanitized.customer) {
    sanitized.customer.fullName = sanitizeString(sanitized.customer.fullName);
    sanitized.customer.email = sanitizeString(sanitized.customer.email)?.toLowerCase();
    sanitized.customer.phone = sanitizeString(sanitized.customer.phone);
  }

  // Sanitize items
  if (Array.isArray(sanitized.items)) {
    sanitized.items = sanitized.items.map(item => ({
      ...item,
      name: sanitizeString(item.name),
      productId: sanitizeString(item.productId),
      price: Number(item.price),
      quantity: Number(item.quantity)
    }));
  }

  // Sanitize delivery address
  if (sanitized.deliveryAddress) {
    Object.keys(sanitized.deliveryAddress).forEach(key => {
      sanitized.deliveryAddress[key] = sanitizeString(sanitized.deliveryAddress[key]);
    });
  }

  // Sanitize pickup location
  if (sanitized.pickupLocationDetails) {
    Object.keys(sanitized.pickupLocationDetails).forEach(key => {
      if (typeof sanitized.pickupLocationDetails[key] === 'string') {
        sanitized.pickupLocationDetails[key] = sanitizeString(sanitized.pickupLocationDetails[key]);
      }
    });
  }

  return sanitized;
}

/**
 * Format phone number to international format
 */
export function formatPhoneNumber(phone) {
  if (!phone) return '';
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // If starts with 0, replace with +33
  if (digits.startsWith('0')) {
    return `+33${digits.substring(1)}`;
  }
  
  // If doesn't start with +, add it
  if (!phone.startsWith('+')) {
    return `+${digits}`;
  }
  
  return phone;
}

/**
 * Validate currency code
 */
export function validateCurrency(currency) {
  const validCurrencies = ['EUR', 'USD', 'GBP', 'CAD'];
  return validCurrencies.includes(currency?.toUpperCase()) ? currency.toUpperCase() : 'EUR';
}

/**
 * Generate secure order reference
 */
export function generateOrderReference() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ORD-${timestamp}-${random}`.toUpperCase();
}