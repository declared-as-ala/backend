import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './config/db.js';
import app from './app.js';

const PORT = process.env.PORT || 5000;

// Connect to database and start server
async function startServer() {
  try {
    await connectDB();
    
    // Only start listening if not in serverless environment
    if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
      app.listen(PORT, () =>
        console.log(`🚀 API running on http://localhost:${PORT}`)
      );
    }
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start server
startServer();

// Export app for Vercel
export default app;
