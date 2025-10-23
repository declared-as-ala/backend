// Vercel API entry point
import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../src/config/db.js';
import app from '../src/app.js';

// Connect to database on cold start
let isConnected = false;

export default async function handler(req, res) {
  // Ensure database connection
  if (!isConnected) {
    try {
      await connectDB();
      isConnected = true;
      console.log('✅ Database connected in Vercel function');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      return res.status(500).json({ 
        error: 'Database connection failed',
        message: error.message 
      });
    }
  }

  // Handle the request using the Express app
  return app(req, res);
}
