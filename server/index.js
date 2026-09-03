// Polyfill SlowBuffer for legacy dependencies (jwa / buffer-equal-constant-time) on modern Node runtimes
const _buffer = require('buffer');
if (typeof global.SlowBuffer === 'undefined') {
  global.SlowBuffer = _buffer.SlowBuffer || _buffer.Buffer;
}
if (global.SlowBuffer && !global.SlowBuffer.prototype) {
  global.SlowBuffer.prototype = _buffer.Buffer.prototype;
}

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
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
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// Import canonical routes
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const predictionRoutes = require('./routes/predictions');
const budgetRoutes = require('./routes/budgets');
const categoryRoutes = require('./routes/categories');
const userRoutes = require('./routes/users');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for reverse proxy platforms (Render, Vercel, Heroku, AWS ALB)
app.set('trust proxy', 1);

// Core security & middleware
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

// Disable caching for API responses to avoid 304/stale data via proxies
app.set('etag', false);
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  next();
});

// Rate limiting on canonical /api routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

// ==========================================
// Health Checks (Liveness vs Readiness)
// ==========================================

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

// 1. Liveness Probe: process is alive and responsive to HTTP traffic
const livenessHandler = (req, res) => {
  res.status(200).json({
    status: 'alive',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
};
app.get('/health/live', livenessHandler);
app.get('/livez', livenessHandler);

// 2. Readiness Probe: database is connected and ready to process transactions
const readinessHandler = (req, res) => {
  const isReady = mongoose.connection.readyState === 1;
  const dbStatus = DB_STATES[mongoose.connection.readyState] || 'unknown';
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
};
app.get('/health/ready', readinessHandler);
app.get('/readyz', readinessHandler);

// 3. Comprehensive Health Check (includes status, uptime, database state)
const healthHandler = (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const dbStatus = DB_STATES[mongoose.connection.readyState] || 'unknown';
  const data = {
    status: isDbConnected ? 'healthy' : 'degraded',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database: dbStatus,
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  };
  res.status(isDbConnected ? 200 : 503).json(data);
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
app.get('/api-status', healthHandler);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'FinSight AI API is running',
    version: '1.0.0',
    canonicalApiBase: '/api'
  });
});

// Middleware guarding database-dependent API endpoints when DB is completely down
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (mongoose.connection.readyState === 0) {
    return res.status(503).json({
      success: false,
      message: 'Database connection is currently unavailable. Please retry momentarily.'
    });
  }
  next();
});

// ==========================================
// Canonical API Routes (/api/*)
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  if (isDev && err.stack) {
    console.error('[STACK]', err.stack);
  }
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(isDev && { error: err.message, stack: err.stack })
  });
});

// Database connection logic with auto-retry
const connectDB = async (retryCount = 0) => {
  const maxRetries = 5;
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/finsight';
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection attempt ${retryCount + 1} failed:`, error.message);
    if (retryCount < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      console.log(`Retrying MongoDB connection in ${delay}ms...`);
      setTimeout(() => connectDB(retryCount + 1), delay);
    } else {
      console.error('CRITICAL: Unable to establish MongoDB connection after max attempts.');
    }
  }
};

// Start server with prompt port binding
const startServer = () => {
  // Bind HTTP port promptly so platform routers (Render) detect readiness without WAN DB delays
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`Canonical API base: http://localhost:${PORT}/api`);
  });

  // Connect to database asynchronously
  connectDB();

  // Server error handling
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
    } else {
      console.error('Server error:', error);
    }
    process.exit(1);
  });

  // Graceful termination
  const gracefulShutdown = (signal) => {
    console.info(`${signal} signal received. Closing HTTP server...`);
    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        await mongoose.connection.close(false);
        console.log('MongoDB connection closed.');
      } catch (e) {
        console.error('Error closing MongoDB connection:', e);
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return server;
};

// Only start listening if executed directly (enables supertest importing app without port binding)
if (require.main === module) {
  startServer();
}

module.exports = app;