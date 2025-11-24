require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const Sentry = require('@sentry/node');
//const { ProfilingIntegration } = require('@sentry/profiling-node');
const winston = require('winston');

const mechanicRoutes = require('./routes/mechanicRoutes');
const userRoutes = require('./routes/userRoutes');
const requestRoutes = require('./routes/requestRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const chatRoutes = require('./routes/chatRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const earningsRoutes = require('./routes/earningsRoutes');

const { supabase } = require('./utils/supabase');

const app = express();

// Initialize Sentry (disabled because no DSN is provided)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
    environment: process.env.NODE_ENV || 'development',
  });

  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'one-rupee-backend' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    ...(process.env.NODE_ENV !== 'production' 
      ? [new winston.transports.Console({ format: winston.format.simple() })]
      : []
    ),
  ],
});

app.use(helmet());

// CORS configuration - allows all origins in dev, specific origins in production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:8080', 'http://localhost:5173'];

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          // In production, be more permissive but log it
          logger.warn(`CORS: Allowing origin ${origin} (not in whitelist)`);
          callback(null, true); // Allow for now, can restrict later
        }
      }
    : true, // Allow all in development
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 5000;

// Verify Supabase connection
if (supabase) {
  logger.info('✅ Supabase client initialized');
} else {
  logger.warn('⚠️  Supabase not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

// Health check
app.get('/', (req, res) => res.json({ 
  ok: true, 
  server: 'one-rupee-backend',
  version: '2.0.0',
  database: supabase ? 'Supabase' : 'Not configured',
  endpoints: {
    user: '/api/user',
    mechanic: '/api/mechanic',
    requests: '/api/requests',
    ratings: '/api/ratings',
    admin: '/api/admin',
    chat: '/api/chat',
    notifications: '/api/notifications',
    earnings: '/api/earnings',
  }
}));

// API Routes
app.use('/api/user', userRoutes);
app.use('/api/mechanic', mechanicRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/earnings', earningsRoutes);

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  Sentry.captureException(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Sentry error handler (must be last)
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Server listening on port ${PORT}`);
  logger.info(`Local: http://localhost:${PORT}`);
  logger.info(`Network: http://YOUR_IP:${PORT}`);
  logger.info(`Database: ${supabase ? 'Supabase PostgreSQL' : 'Not configured'}`);
  console.log(`\nTo find your IP address:`);
  console.log(`  Windows: ipconfig`);
  console.log(`  Mac/Linux: ifconfig or hostname -I`);
});

module.exports = { app, logger };
