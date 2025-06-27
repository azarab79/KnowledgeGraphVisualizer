/**
 * Proxy Middleware for FastAPI Communication
 * 
 * Handles proxying requests to the Python FastAPI service with session
 * management and conversation storage.
 */

const { createProxyMiddleware } = require('http-proxy-middleware');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'proxy-middleware' },
  transports: [
    new winston.transports.File({ filename: 'logs/proxy-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/proxy-combined.log' }),
  ],
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Create proxy middleware for FastAPI endpoints
 * @param {string} target - FastAPI server URL
 * @param {object} options - Additional proxy options
 * @returns {Function} Express middleware function
 */
function createFastAPIProxy(target, options = {}) {
  const defaultOptions = {
    target,
    changeOrigin: true,
    secure: false, // Set to true for HTTPS in production
    timeout: 60000, // 60 seconds
    followRedirects: true,
    logLevel: process.env.NODE_ENV === 'production' ? 'error' : 'info',
    
    // Custom path rewriting
    pathRewrite: {
      '^/api/chat': '/chat', // Remove /api prefix for FastAPI routes
    },
    
    // Headers modification
    onProxyReq: (proxyReq, req, res) => {
      logger.info(`Proxying ${req.method} request to: ${target}${proxyReq.path}`, {
        originalUrl: req.originalUrl,
        sessionId: req.sessionID,
        userAgent: req.get('User-Agent'),
        contentType: req.get('Content-Type'),
      });
      
      // Add session information to the proxy request
      if (req.sessionID) {
        proxyReq.setHeader('X-Session-ID', req.sessionID);
      }
      
      // Add correlation ID for request tracing
      const correlationId = req.get('X-Correlation-ID') || 
                           `proxy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      proxyReq.setHeader('X-Correlation-ID', correlationId);
      
      // Forward user IP
      if (req.ip) {
        proxyReq.setHeader('X-Forwarded-For', req.ip);
      }
      
      // Ensure proper content type for JSON requests
      if (req.body && typeof req.body === 'object') {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    
    // Response modification
    onProxyRes: (proxyRes, req, res) => {
      logger.info(`Received response from FastAPI`, {
        statusCode: proxyRes.statusCode,
        method: req.method,
        url: req.originalUrl,
        sessionId: req.sessionID,
        processingTime: Date.now() - req.startTime,
      });
      
      // Add CORS headers if not present
      if (!proxyRes.headers['access-control-allow-origin']) {
        proxyRes.headers['access-control-allow-origin'] = req.get('Origin') || '*';
      }
      if (!proxyRes.headers['access-control-allow-credentials']) {
        proxyRes.headers['access-control-allow-credentials'] = 'true';
      }
      
      // Add caching headers for appropriate responses
      if (proxyRes.statusCode === 200 && req.method === 'GET') {
        proxyRes.headers['cache-control'] = 'no-cache, no-store, must-revalidate';
      }
    },
    
    // Error handling
    onError: (err, req, res) => {
      logger.error('Proxy error occurred', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.originalUrl,
        sessionId: req.sessionID,
        target,
      });
      
      // Don't send response if headers already sent
      if (res.headersSent) {
        return;
      }
      
      // Determine error response based on error type
      let statusCode = 500;
      let errorMessage = 'Service temporarily unavailable';
      
      if (err.code === 'ECONNREFUSED') {
        statusCode = 503;
        errorMessage = 'Backend service is not available';
      } else if (err.code === 'ETIMEDOUT') {
        statusCode = 504;
        errorMessage = 'Request timeout';
      } else if (err.code === 'ENOTFOUND') {
        statusCode = 502;
        errorMessage = 'Backend service not found';
      }
      
      res.status(statusCode).json({
        error: errorMessage,
        code: err.code,
        timestamp: new Date().toISOString(),
        correlationId: req.get('X-Correlation-ID'),
      });
    },
    
    // Retry logic
    onProxyReqWs: (proxyReq, req, socket) => {
      logger.info('WebSocket proxy request', {
        url: req.url,
        sessionId: req.sessionID,
      });
    },
  };
  
  // Merge with custom options
  const proxyOptions = { ...defaultOptions, ...options };
  
  return createProxyMiddleware(proxyOptions);
}

/**
 * Middleware to add request timing
 */
function addRequestTiming(req, res, next) {
  req.startTime = Date.now();
  next();
}

/**
 * Create health check proxy for FastAPI health endpoint
 */
function createHealthCheckProxy(target) {
  return createFastAPIProxy(target, {
    pathRewrite: {
      '^/api/health': '/health',
    },
    timeout: 5000, // Shorter timeout for health checks
  });
}

module.exports = {
  createFastAPIProxy,
  createHealthCheckProxy,
  addRequestTiming,
}; 