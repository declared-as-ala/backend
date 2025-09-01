import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { tinyRateLimit } from './middleware/rateLimit.js';
import productRoutes from './routes/product.routes.js';
import StripeRoutes from './routes/stripe.routes.js';
// ... existing imports above

import customerAuthRoutes from './routes/customerAuth.routes.js';
import customerOrderRoutes from './routes/customerOrder.routes.js';
import { customerAuth } from './middleware/customerAuth.js';
import Customerdiscountroutes from './routes/reduce.routes.js';
// routes/index.js or app.js
import paypalRoutes from './routes/paypal.routes.js';
import forgetpassword from './routes/forgetpassword.routes.js';
// Use PayPal routes

const app = express();

// Standard middlewares (before body parsing)
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || '*' }));
app.use(morgan('dev'));
app.use(tinyRateLimit());

// ⚠️ CRITICAL: Handle Stripe webhook BEFORE any JSON parsing
// This must come before express.json() to preserve raw body
app.use(
  '/api/payments/stripe/webhook',
  express.raw({ type: 'application/json' })
);

// JSON parser for all other routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Disable caching for all API responses
app.disable('etag');

// Disable caching for APIs
app.use('/api', (req, res, next) => {
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, private'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Routes
app.use('/api', customerAuthRoutes);
app.use('/api', forgetpassword);
app.use('/api/orders', customerAuth, customerOrderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/payments', StripeRoutes);
app.use('/api/payments/paypal', paypalRoutes);

app.use('/api/discounts', Customerdiscountroutes);

export default app;
