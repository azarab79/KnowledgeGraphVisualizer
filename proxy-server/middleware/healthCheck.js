/**
 * Health Check Middleware
 * 
 * Monitors the health of the Python FastAPI service and provides
 * comprehensive health status information.
 */

const axios = require('axios');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'health-check' },
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

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

// Health status cache
let healthCache = {
  status: 'unknown',
  lastCheck: null,
  details: {},
  uptime: process.uptime(),
};

/**
 * Check the health of the FastAPI service
 */
async function checkFastAPIHealth() {
  try {
    const startTime = Date.now();
    
    const response = await axios.get(`${FASTAPI_URL}/health`, {
      timeout: 5000, // 5 seconds
      headers: {
        'User-Agent': 'KG-QA-Proxy-Health-Check',
      },
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.status === 200) {
      healthCache = {
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        details: {
          fastapi: {
            status: 'healthy',
            responseTime: `${responseTime}ms`,
            data: response.data,
          },
          proxy: {
            status: 'healthy',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            pid: process.pid,
          },
        },
        uptime: process.uptime(),
      };
      
      logger.debug('FastAPI health check successful', {
        responseTime,
        status: response.status,
      });
      
      return true;
    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
    
  } catch (error) {
    logger.warn('FastAPI health check failed', {
      error: error.message,
      code: error.code,
    });
    
    healthCache = {
      status: 'unhealthy',
      lastCheck: new Date().toISOString(),
      details: {
        fastapi: {
          status: 'unhealthy',
          error: error.message,
          code: error.code,
        },
        proxy: {
          status: 'healthy',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          pid: process.pid,
        },
      },
      uptime: process.uptime(),
    };
    
    return false;
  }
}

/**
 * Middleware for health check endpoint
 */
async function healthCheckHandler(req, res) {
  try {
    // Force a fresh health check if requested
    const forceCheck = req.query.force === 'true';
    
    if (forceCheck || !healthCache.lastCheck || 
        Date.now() - new Date(healthCache.lastCheck).getTime() > 30000) {
      await checkFastAPIHealth();
    }
    
    const httpStatus = healthCache.status === 'healthy' ? 200 : 503;
    
    res.status(httpStatus).json({
      status: healthCache.status,
      timestamp: new Date().toISOString(),
      service: 'kg-qa-proxy',
      version: '1.0.0',
      lastCheck: healthCache.lastCheck,
      uptime: healthCache.uptime,
      details: healthCache.details,
      environment: process.env.NODE_ENV || 'development',
    });
    
  } catch (error) {
    logger.error('Health check handler error', {
      error: error.message,
      stack: error.stack,
    });
    
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'kg-qa-proxy',
      error: 'Health check failed',
      message: error.message,
    });
  }
}

/**
 * Start periodic health checks
 */
function startPeriodicHealthChecks(intervalMs = 60000) {
  logger.info('Starting periodic health checks', { intervalMs });
  
  // Run initial check
  checkFastAPIHealth();
  
  // Schedule periodic checks
  setInterval(async () => {
    try {
      await checkFastAPIHealth();
    } catch (error) {
      logger.error('Periodic health check error', {
        error: error.message,
      });
    }
  }, intervalMs);
}

/**
 * Get current health status
 */
function getCurrentHealthStatus() {
  return { ...healthCache };
}

/**
 * Middleware to check if FastAPI is available before proxying
 */
function requireHealthyBackend(req, res, next) {
  if (healthCache.status === 'healthy') {
    next();
  } else {
    res.status(503).json({
      error: 'Backend service is currently unavailable',
      code: 'BACKEND_UNAVAILABLE',
      timestamp: new Date().toISOString(),
      lastHealthCheck: healthCache.lastCheck,
    });
  }
}

module.exports = {
  healthCheckHandler,
  startPeriodicHealthChecks,
  getCurrentHealthStatus,
  requireHealthyBackend,
  checkFastAPIHealth,
}; 