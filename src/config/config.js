
// config/paypal.config.js (Backend)
export const paypalConfig = {
  environment: process.env.PAYPAL_ENVIRONMENT || 'sandbox',
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,

  // API endpoints
  apiUrls: {
    sandbox: 'https://api-m.sandbox.paypal.com',
    live: 'https://api-m.paypal.com',
  },

  // Web checkout URLs
  webUrls: {
    sandbox: 'https://www.sandbox.paypal.com',
    live: 'https://www.paypal.com',
  },

  // Supported currencies
  supportedCurrencies: ['EUR', 'USD', 'GBP', 'CAD'],

  // Request timeouts
  timeouts: {
    token: 10000, // 10 seconds for token requests
    order: 30000, // 30 seconds for order operations
    capture: 30000, // 30 seconds for capture operations
  },

  // Rate limiting
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 50, // Max requests per window
  },

  // Retry configuration
  retry: {
    attempts: 3,
    delay: 1000, // 1 second base delay
  },

  // Webhook configuration
  webhooks: {
    enabled: process.env.PAYPAL_WEBHOOKS_ENABLED === 'true',
    url: process.env.PAYPAL_WEBHOOK_URL,
    events: [
      'PAYMENT.CAPTURE.COMPLETED',
      'PAYMENT.CAPTURE.DENIED',
      'PAYMENT.CAPTURE.PENDING',
      'CHECKOUT.ORDER.APPROVED',
      'CHECKOUT.ORDER.CANCELLED',
    ],
  },
};

/**
 * Validate backend PayPal configuration
 */
export const validateBackendPayPalConfig = () => {
  const requiredFields = {
    PAYPAL_CLIENT_ID: paypalConfig.clientId,
    PAYPAL_CLIENT_SECRET: paypalConfig.clientSecret,
  };

  const missingFields = Object.entries(requiredFields)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missingFields.length > 0) {
    throw new Error(
      `Missing required PayPal configuration: ${missingFields.join(', ')}`
    );
  }

  if (!['sandbox', 'live'].includes(paypalConfig.environment)) {
    throw new Error('PAYPAL_ENVIRONMENT must be either "sandbox" or "live"');
  }

  return true;
};

// .env.example (Backend)
/*
# PayPal Configuration
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_CLIENT_ID=your_paypal_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_client_secret_here

# Optional PayPal Webhook Configuration
PAYPAL_WEBHOOKS_ENABLED=false
PAYPAL_WEBHOOK_URL=https://yourapp.com/api/payments/paypal/webhook

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/ecommerce

# Application Configuration
NODE_ENV=development
PORT=3001
JWT_SECRET=your_jwt_secret_here

# Logging Configuration
LOG_LEVEL=INFO

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19000
*/

// app.config.js (Frontend - Expo)
/*
export default {
  expo: {
    name: "Your App Name",
    slug: "your-app-slug",
    // ... other config
    extra: {
      paypalClientId: process.env.EXPO_PUBLIC_PAYPAL_CLIENT_ID,
      paypalEnvironment: process.env.EXPO_PUBLIC_PAYPAL_ENVIRONMENT || 'sandbox',
    },
    scheme: "myapp", // Important for deep linking
    // ... rest of your config
  },
};
*/

// .env.example (Frontend)
/*
# PayPal Configuration (Frontend)
EXPO_PUBLIC_PAYPAL_CLIENT_ID=your_paypal_client_id_here
EXPO_PUBLIC_PAYPAL_ENVIRONMENT=sandbox

# API Configuration
EXPO_PUBLIC_API_URL=http://localhost:3001/api
*/
