require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const cookieParser = require('cookie-parser');
const corsOptions = require('./config/cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';

// Validate required env vars at startup
const requiredEnvVars = ['JWT_SECRET', 'JWT_COOKIE_EXPIRE'];
const missing = requiredEnvVars.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error('[STARTUP ERROR] Missing required environment variables:', missing.join(', '));
  console.error('Ensure server/.env exists with JWT_SECRET and JWT_COOKIE_EXPIRE set.');
  process.exit(1);
}

// Import routes
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const predictionRoutes = require('./routes/predictions');
const budgetRoutes = require('./routes/budgets');
const categoryRoutes = require('./routes/categories');
const userRoutes = require('./routes/users');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// Security & core middleware
app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json({ limit: '200kb' }));
app.use(morgan(isDev ? 'dev' : 'combined'));
if (isDev) {
  app.use((req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT') {
      const body = { ...req.body };
      if (body.password) body.password = '[REDACTED]';
      if (body.currentPassword) body.currentPassword = '[REDACTED]';
      if (body.newPassword) body.newPassword = '[REDACTED]';
      console.log(`[REQ] ${req.method} ${req.originalUrl}`, Object.keys(body).length ? body : '');
    }
    next();
  });
}
app.use(cookieParser());

// Disable caching for API responses to avoid 304/empty bodies via proxies
app.set('etag', false);
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/finsight');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'FinSight AI API is running' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);

// Also mount routes directly for compatibility with frontend
app.use('/transactions', transactionRoutes);
app.use('/budgets', budgetRoutes);
app.use('/categories', categoryRoutes);

// Serve static assets in production - DISABLED for separate frontend deployment
// if (process.env.NODE_ENV === 'production') {
//   app.use(express.static(path.join(__dirname, '../client/build')));
  
//   app.get('*', (req, res) => {
//     res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
//   });
// }

// API-only mode for separate frontend deployment
app.get('/api-status', (req, res) => {
  res.json({ 
    status: 'online',
    message: 'FinSight API is running in API-only mode',
    environment: process.env.NODE_ENV
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  console.error('[STACK]', err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Something went wrong!',
    ...(isDev && { error: err.message, stack: err.stack })
  });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      if (isDev) {
        console.log(`API base: http://localhost:${PORT}/api`);
        console.log('Ensure client .env has REACT_APP_API_URL=http://localhost:' + PORT + '/api');
      }
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please use a different port.`);
        process.exit(1);
      } else {
        console.error('Server error:', error);
        process.exit(1);
      }
    });

    // Handle process termination
    process.on('SIGTERM', () => {
      console.info('SIGTERM signal received.');
      server.close(() => {
        console.log('Server closed.');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app; // For testing purposes 