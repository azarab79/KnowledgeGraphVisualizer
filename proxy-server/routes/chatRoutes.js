/**
 * Chat Routes
 * 
 * Express router for chat-related endpoints with proper middleware
 * and error handling.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const chatController = require('../controllers/chatController');

const router = express.Router();

// Rate limiting for chat endpoints
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 chat requests per minute
  message: {
    error: 'Too many chat requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to message endpoint
router.use('/message', chatLimiter);

// Middleware to ensure session exists
function ensureSession(req, res, next) {
  if (!req.sessionID) {
    return res.status(401).json({
      error: 'Session required',
      code: 'NO_SESSION',
      timestamp: new Date().toISOString(),
    });
  }
  next();
}

// Apply session middleware to all chat routes
router.use(ensureSession);

// Validation middleware for message endpoint
function validateMessage(req, res, next) {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({
      error: 'Message is required',
      code: 'MISSING_MESSAGE',
      timestamp: new Date().toISOString(),
    });
  }
  
  if (typeof message !== 'string') {
    return res.status(400).json({
      error: 'Message must be a string',
      code: 'INVALID_MESSAGE_TYPE',
      timestamp: new Date().toISOString(),
    });
  }
  
  if (message.trim().length === 0) {
    return res.status(400).json({
      error: 'Message cannot be empty',
      code: 'EMPTY_MESSAGE',
      timestamp: new Date().toISOString(),
    });
  }
  
  if (message.length > 10000) {
    return res.status(400).json({
      error: 'Message too long (max 10,000 characters)',
      code: 'MESSAGE_TOO_LONG',
      timestamp: new Date().toISOString(),
    });
  }
  
  next();
}

/**
 * Chat Routes
 */

// POST /api/chat/message - Send a message to the chat system
router.post('/message', validateMessage, chatController.sendMessage);

// GET /api/chat/history - Get conversation history for the current session
router.get('/history', chatController.getHistory);

// DELETE /api/chat/history - Clear conversation history for the current session
router.delete('/history', chatController.clearHistory);

// GET /api/chat/suggestions - Get suggested questions or topics
router.get('/suggestions', chatController.getSuggestions);

// GET /api/chat/stats - Get conversation statistics
router.get('/stats', chatController.getStats);

module.exports = router; 