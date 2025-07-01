 import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import expressWinston from 'express-winston';
import morgan from 'morgan';
import mongoose from 'mongoose';
import session from 'express-session';
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
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "trusted-cdn.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", process.env.PRODUCTION_FRONTEND_URL]
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Request Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
  app.use(expressWinston.logger({
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'logs/combined.log' })
    ],
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.json()
    ),
    meta: true,
    msg: "HTTP {{req.method}} {{req.url}}",
    expressFormat: true,
    colorize: false,
    ignoreRoute: (req, res) => false
  }));
}

app.use(express.static(path.join(__dirname, 'images')));

// CORS Configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? [
        process.env.PRODUCTION_FRONTEND_URL,
        'https://www.your-domain.com'
      ]
    : 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Body Parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log('Incoming Request:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
    query: req.query
  });
  next();
});

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    domain: process.env.COOKIE_DOMAIN || undefined,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Trust proxy in production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 200 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later'
});
app.use(limiter);

// Data Sanitization
const sanitizeData = (obj) => {
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeData(obj[key]);
    } else if (typeof obj[key] === 'string') {
      obj[key] = obj[key].replace(/\$/g, '').replace(/\./g, '');
    }
  });
};

app.use((req, res, next) => {
  if (req.body) sanitizeData(req.body);
  if (req.query) sanitizeData(req.query);
  next();
});

// API Routes
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/quotes', quoteRoutes);
app.use('/api/v1/testimonials', testimonialRoutes);

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
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
  });
});