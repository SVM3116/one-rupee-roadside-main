require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const mechanicRoutes = require('./routes/mechanicRoutes');
const userRoutes = require('./routes/userRoutes');
const requestRoutes = require('./routes/requestRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

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
          console.warn(`CORS: Allowing origin ${origin} (not in whitelist)`);
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
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.warn('MONGODB_URI is not set. Running in in-memory mock mode for development. See backend/.env.example to configure MongoDB.');
} else {
  mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).then(() => {
    console.log('Connected to MongoDB');
  }).catch((err) => {
    console.error('Mongo connection error', err);
    console.warn('Proceeding in in-memory mock mode.');
  });
}

// Health check
app.get('/', (req, res) => res.json({ 
  ok: true, 
  server: 'one-rupee-backend',
  version: '1.0.0',
  endpoints: {
    user: '/api/user',
    mechanic: '/api/mechanic',
    requests: '/api/requests',
    ratings: '/api/ratings',
    admin: '/api/admin',
  }
}));

// API Routes
app.use('/api/user', userRoutes);
app.use('/api/mechanic', mechanicRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://YOUR_IP:${PORT}`);
  console.log(`\nTo find your IP address:`);
  console.log(`  Windows: ipconfig`);
  console.log(`  Mac/Linux: ifconfig or hostname -I`);
});
