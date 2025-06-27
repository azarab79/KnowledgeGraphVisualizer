/**
 * Knowledge Graph QA Proxy Server
 * 
 * Express.js proxy server that acts as a middleman between the frontend
 * and the Python FastAPI service, handling session management and API routing.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

const winston = require('winston');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PROXY_PORT || 3003;
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key-change-in-production';

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'kg-qa-proxy' },
  transports: [
    new winston.transports.File({ filename: 'logs/proxy-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/proxy-combined.log' }),
  ],
});

// Add console logging in development
if (NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Middleware setup
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost in development
    if (NODE_ENV === 'development' && origin.includes('localhost')) {
      return callback(null, true);
    }
    
    // Add your frontend domains here
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:5173', // Vite dev server
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
  name: 'kg-qa-session',
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    sessionId: req.sessionID,
  });
  next();
});

// Import health check middleware
const { healthCheckHandler, startPeriodicHealthChecks } = require('./middleware/healthCheck');

// Health check endpoint
app.get('/health', healthCheckHandler);

// Start periodic health monitoring
startPeriodicHealthChecks();



// Import route modules
const chatRoutes = require('./routes/chatRoutes');
const { createFastAPIProxy, addRequestTiming } = require('./middleware/proxyMiddleware');

// Add request timing middleware
app.use(addRequestTiming);

// Chat routes (handles specific endpoints with session management)
app.use('/api/chat', chatRoutes);

// Fallback proxy for any other FastAPI endpoints
const fallbackProxy = createFastAPIProxy(FASTAPI_URL, {
  pathRewrite: {
    '^/api/': '/', // Remove /api prefix for other FastAPI routes
  },
});

app.use('/api/', fallbackProxy);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  // Don't leak error details in production
  const errorMessage = NODE_ENV === 'production' 
    ? 'Internal server error'
    : err.message;
  
  res.status(err.status || 500).json({
    error: errorMessage,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.url} not found`,
  });
});

// Start server only if not in test environment
let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    logger.info(`Proxy server running on port ${PORT}`);
    logger.info(`Proxying to FastAPI at: ${FASTAPI_URL}`);
    logger.info(`Environment: ${NODE_ENV}`);
  });
}

// Export app for testing
module.exports = app;

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = app; 