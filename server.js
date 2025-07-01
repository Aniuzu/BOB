import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import path from 'path';
import connectDB from './config/db.js';
import productRoutes from './routes/productRoutes.js';
import quoteRoutes from './routes/quoteRoutes.js';
import testimonialRoutes from './routes/testimonialRoutes.js';

// Initialize configuration
dotenv.config();

// File path configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database Connection
connectDB();

// Express App
const app = express();

// Security Headers
app.use(helmet());

// Request Logging
app.use(morgan('dev'));

app.use(express.static(path.join(__dirname, 'images')));


// CORS Configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.PRODUCTION_FRONTEND_URL
    : 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  exposedHeaders: ['Content-Length', 'X-Request-ID']
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use((req, res, next) => {
  console.log('Incoming Request:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body, // Now should show parsed body
    query: req.query
  });
  next();
});


// API Routes
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/quotes', quoteRoutes);
app.use('/api/v1/testimonials', testimonialRoutes);

app.use((req, res, next) => {
  console.log(`Incoming ${req.method} request from ${req.headers.origin}`);
  next();
});

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});
app.use(limiter);

// Body Parsing


// Data Sanitization (simplified to avoid errors)
app.use((req, res, next) => {
  if (req.body) sanitizeData(req.body);
  if (req.query) sanitizeData(req.query);
  next();
});

function sanitizeData(obj) {
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeData(obj[key]);
    } else if (typeof obj[key] === 'string') {
      // Basic NoSQL injection prevention
      obj[key] = obj[key].replace(/\$/g, '').replace(/\./g, '');
    }
  });
}

app.use((req, res, next) => {
  console.log('Incoming body:', req.body);
  console.log('Content-Type:', req.get('Content-Type'));
  next();
});


// Health Check Endpoint
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Static Files in Production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
  });
}

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Internal Server Error'
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Not Found'
  });
});

// Server Startup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
  });
});