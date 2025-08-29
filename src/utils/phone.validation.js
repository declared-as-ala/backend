// utils/phone.validation.js
import { logger } from './logger.js';

/**
 * Phone number validation and formatting utilities
 */

// Country-specific phone number patterns
const PHONE_PATTERNS = {
  FR: {
    pattern: /^(?:\+33|0)[1-9](?:\d{8})$/,
    format: (num) => {
      const cleaned = num.replace(/\D/g, '');
      if (cleaned.startsWith('33')) {
        return '+33' + cleaned.substring(2);
      }
      if (cleaned.startsWith('0')) {
        return '+33' + cleaned.substring(1);
      }
      return '+33' + cleaned;
    },
    example: '+33123456789 or 0123456789'
  },
  US: {
    pattern: /^(?:\+1)?[2-9]\d{2}[2-9]\d{2}\d{4}$/,
    format: (num) => {
      const cleaned = num.replace(/\D/g, '');
      return cleaned.startsWith('1') ? '+' + cleaned : '+1' + cleaned;
    },
    example: '+1234567890'
  },
  GB: {
    pattern: /^(?:\+44|0)[1-9]\d{8,9}$/,
    format: (num) => {
      const cleaned = num.replace(/\D/g, '');
      if (cleaned.startsWith('44')) {
        return '+44' + cleaned.substring(2);
      }
      if (cleaned.startsWith('0')) {
        return '+44' + cleaned.substring(1);
      }
      return '+44' + cleaned;
    },
    example: '+44123456789'
  }
};

/**
 * Clean phone number by removing formatting characters
 */
export const cleanPhoneNumber = (phone) => {
  if (typeof phone !== 'string') return '';
  return phone.replace(/[\s\-\.\(\)\[\]]/g, '');
};

/**
 * Detect country from phone number
 */
export const detectPhoneCountry = (phone) => {
  const cleaned = cleanPhoneNumber(phone);
  
  if (cleaned.startsWith('+33') || cleaned.startsWith('0')) return 'FR';
  if (cleaned.startsWith('+1')) return 'US';
  if (cleaned.startsWith('+44')) return 'GB';
  
  return 'UNKNOWN';
};

/**
 * Validate phone number format
 */
export const validatePhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return {
      isValid: false,
      error: 'Phone number is required',
      formatted: null
    };
  }

  const cleaned = cleanPhoneNumber(phone);
  
  // Basic length check
  if (cleaned.length < 8 || cleaned.length > 20) {
    return {
      isValid: false,
      error: 'Phone number must be between 8 and 20 characters',
      formatted: null
    };
  }

  // International format check (starts with +)
  if (cleaned.startsWith('+')) {
    const digits = cleaned.substring(1);
    
    if (!/^\d+$/.test(digits)) {
      return {
        isValid: false,
        error: 'Phone number can only contain digits after country code',
        formatted: null
      };
    }
    
    if (digits.length < 7 || digits.length > 15) {
      return {
        isValid: false,
        error: 'Phone number must have 7-15 digits after country code',
        formatted: null
      };
    }
    
    return {
      isValid: true,
      error: null,
      formatted: cleaned,
      country: detectPhoneCountry(cleaned)
    };
  }

  // French domestic format (starts with 0)
  if (cleaned.startsWith('0')) {
    if (!/^0[1-9]\d{8}$/.test(cleaned)) {
      return {
        isValid: false,
        error: 'French phone number format: 0123456789 (10 digits starting with 0)',
        formatted: null
      };
    }
    
    return {
      isValid: true,
      error: null,
      formatted: '+33' + cleaned.substring(1),
      country: 'FR'
    };
  }

  // Only digits (assume needs country code)
  if (/^\d+$/.test(cleaned)) {
    // If 9 digits, might be French without the 0
    if (cleaned.length === 9 && /^[1-9]/.test(cleaned)) {
      return {
        isValid: true,
        error: null,
        formatted: '+33' + cleaned,
        country: 'FR'
      };
    }
    
    // If 10 digits starting with 1, might be US
    if (cleaned.length === 10 && cleaned.startsWith('1')) {
      return {
        isValid: true,
        error: null,
        formatted: '+1' + cleaned,
        country: 'US'
      };
    }
  }

  return {
    isValid: false,
    error: 'Phone number format not recognized. Use international format (+33123456789) or French domestic (0123456789)',
    formatted: null
  };
};

/**
 * Format phone number for display
 */
export const formatPhoneForDisplay = (phone) => {
  const validation = validatePhoneNumber(phone);
  
  if (!validation.isValid) {
    return phone; // Return original if invalid
  }
  
  const formatted = validation.formatted;
  
  // Format French numbers: +33 1 23 45 67 89
  if (formatted.startsWith('+33')) {
    const digits = formatted.substring(3);
    return `+33 ${digits.substring(0, 1)} ${digits.substring(1, 3)} ${digits.substring(3, 5)} ${digits.substring(5, 7)} ${digits.substring(7)}`;
  }
  
  // Format US numbers: +1 (234) 567-8900
  if (formatted.startsWith('+1')) {
    const digits = formatted.substring(2);
    return `+1 (${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
  }
  
  return formatted;
};

/**
 * Express validator middleware using the validation function
 */
export const phoneValidationMiddleware = () => {
  return (value) => {
    const result = validatePhoneNumber(value);
    
    if (!result.isValid) {
      throw new Error(result.error);
    }
    
    return true;
  };
};

/**
 * Test phone validation with common formats
 */
export const testPhoneValidation = () => {
  const testNumbers = [
    '+33123456789',
    '0123456789',
    '+33 1 23 45 67 89',
    '01 23 45 67 89',
    '+1234567890',
    '+44123456789',
    '123456789', // Should format to +33
    'invalid',
    '123'
  ];

  logger.info('Testing phone validation:');
  
  testNumbers.forEach(phone => {
    const result = validatePhoneNumber(phone);
    logger.info(`${phone} -> `, result);
  });
};