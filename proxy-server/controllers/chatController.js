/**
 * Chat Controller
 * 
 * Handles chat-related endpoints with session-based conversation storage
 * and proxying to the FastAPI service.
 */

const winston = require('winston');
const axios = require('axios');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'chat-controller' },
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

// In-memory conversation storage (in production, use Redis or database)
const conversationStore = new Map();

/**
 * Initialize session conversation storage
 */
function initializeConversation(sessionId) {
  if (!conversationStore.has(sessionId)) {
    conversationStore.set(sessionId, {
      messages: [],
      createdAt: Date.now(),
      lastActivity: Date.now(),
    });
  }
  return conversationStore.get(sessionId);
}

/**
 * Update conversation in session storage
 */
function updateConversation(sessionId, message, response) {
  const conversation = initializeConversation(sessionId);
  
  conversation.messages.push({
    timestamp: Date.now(),
    user: message,
    assistant: response,
  });
  
  conversation.lastActivity = Date.now();
  
  // Keep only last 50 messages to prevent memory overflow
  if (conversation.messages.length > 50) {
    conversation.messages = conversation.messages.slice(-50);
  }
  
  conversationStore.set(sessionId, conversation);
  return conversation;
}

/**
 * Clean up old conversations (run periodically)
 */
function cleanupOldConversations() {
  const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
  
  for (const [sessionId, conversation] of conversationStore.entries()) {
    if (conversation.lastActivity < cutoffTime) {
      conversationStore.delete(sessionId);
      logger.info(`Cleaned up conversation for session: ${sessionId}`);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupOldConversations, 60 * 60 * 1000);

/**
 * POST /api/chat/message
 * Send a message to the chat system
 */
async function sendMessage(req, res) {
  try {
    const { message, context } = req.body;
    const sessionId = req.sessionID;
    
    logger.info('Received chat message', {
      sessionId,
      messageLength: message?.length,
      hasContext: !!context,
    });
    
    // Validate input
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Message is required and must be a non-empty string',
        timestamp: new Date().toISOString(),
      });
    }
    
    // Get conversation history
    const conversation = initializeConversation(sessionId);
    
    // Prepare request to FastAPI
    const fastApiRequest = {
      question: message.trim(),
      conversation_history: conversation.messages.map(msg => ({
        user: msg.user,
        assistant: msg.assistant,
        timestamp: msg.timestamp,
      })),
      context: context || {},
    };
    
    // Add correlation ID
    const correlationId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send request to FastAPI
    const response = await axios.post(`${FASTAPI_URL}/chat`, fastApiRequest, {
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId,
        'X-Correlation-ID': correlationId,
      },
      timeout: 60000, // 60 seconds
    });
    
    const assistantResponse = response.data.answer || response.data.response || 'No response received';
    
    // Extract source documents from response if available
    const sourceDocuments = response.data.source_documents || 
                            response.data.sourceDocuments || 
                            [];
    
    // Extract source nodes from response if available
    const sourceNodes = response.data.source_nodes || 
                       response.data.sourceNodes || 
                       [];
    
    // Update conversation history
    updateConversation(sessionId, message, assistantResponse);
    
    logger.info('Chat message processed successfully', {
      sessionId,
      correlationId,
      responseLength: assistantResponse.length,
      documentsFound: sourceDocuments.length,
      nodesFound: sourceNodes.length,
    });
    
    // Return response with source documents and nodes
    res.json({
      response: assistantResponse,
      sourceDocuments: sourceDocuments,
      sourceNodes: sourceNodes,
      sessionId,
      timestamp: new Date().toISOString(),
      correlationId,
      metadata: {
        ...response.data.metadata,
        documents_found: sourceDocuments.length,
        nodes_found: sourceNodes.length,
        kg_success: response.data.kg_success,
        llm_used: response.data.llm_used
      },
    });
    
  } catch (error) {
    logger.error('Error processing chat message', {
      error: error.message,
      stack: error.stack,
      sessionId: req.sessionID,
    });
    
    // Handle different error types
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Chat service is temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
        sourceDocuments: [],
        sourceNodes: [],
        timestamp: new Date().toISOString(),
      });
    }
    
    if (error.code === 'ETIMEDOUT') {
      return res.status(504).json({
        error: 'Request timeout - please try again',
        code: 'TIMEOUT',
        sourceDocuments: [],
        sourceNodes: [],
        timestamp: new Date().toISOString(),
      });
    }
    
    res.status(500).json({
      error: 'An error occurred while processing your message',
      code: 'INTERNAL_ERROR',
      sourceDocuments: [],
      sourceNodes: [],
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * GET /api/chat/history
 * Get conversation history for the current session
 */
function getHistory(req, res) {
  try {
    const sessionId = req.sessionID;
    const conversation = conversationStore.get(sessionId);
    
    if (!conversation) {
      return res.json({
        messages: [],
        sessionId,
        timestamp: new Date().toISOString(),
      });
    }
    
    logger.info('Retrieved conversation history', {
      sessionId,
      messageCount: conversation.messages.length,
    });
    
    res.json({
      messages: conversation.messages,
      sessionId,
      createdAt: new Date(conversation.createdAt).toISOString(),
      lastActivity: new Date(conversation.lastActivity).toISOString(),
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    logger.error('Error retrieving conversation history', {
      error: error.message,
      sessionId: req.sessionID,
    });
    
    res.status(500).json({
      error: 'Failed to retrieve conversation history',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * DELETE /api/chat/history
 * Clear conversation history for the current session
 */
function clearHistory(req, res) {
  try {
    const sessionId = req.sessionID;
    
    if (conversationStore.has(sessionId)) {
      conversationStore.delete(sessionId);
      logger.info('Cleared conversation history', { sessionId });
    }
    
    res.json({
      message: 'Conversation history cleared',
      sessionId,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    logger.error('Error clearing conversation history', {
      error: error.message,
      sessionId: req.sessionID,
    });
    
    res.status(500).json({
      error: 'Failed to clear conversation history',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * GET /api/chat/suggestions
 * Get suggested questions or topics
 */
async function getSuggestions(req, res) {
  try {
    const sessionId = req.sessionID;
    const conversation = conversationStore.get(sessionId);
    
    // Default suggestions
    let suggestions = [
      "What types of entities are in the knowledge graph?",
      "How are entities connected in the graph?",
      "Can you analyze the relationship patterns?",
      "What insights can you provide about the data?",
    ];
    
    // If we have conversation history, get contextual suggestions from FastAPI
    if (conversation && conversation.messages.length > 0) {
      try {
        const response = await axios.get(`${FASTAPI_URL}/chat/suggestions`, {
          headers: {
            'X-Session-ID': sessionId,
          },
          params: {
            context: JSON.stringify(conversation.messages.slice(-3)), // Last 3 messages
          },
          timeout: 10000, // 10 seconds
        });
        
        if (response.data.suggestions && Array.isArray(response.data.suggestions)) {
          suggestions = response.data.suggestions;
        }
      } catch (error) {
        logger.warn('Failed to get contextual suggestions, using defaults', {
          error: error.message,
          sessionId,
        });
      }
    }
    
    logger.info('Retrieved chat suggestions', {
      sessionId,
      suggestionCount: suggestions.length,
    });
    
    res.json({
      suggestions,
      sessionId,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    logger.error('Error retrieving chat suggestions', {
      error: error.message,
      sessionId: req.sessionID,
    });
    
    res.status(500).json({
      error: 'Failed to retrieve suggestions',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * GET /api/chat/stats
 * Get conversation statistics
 */
function getStats(req, res) {
  try {
    const sessionId = req.sessionID;
    const conversation = conversationStore.get(sessionId);
    
    const stats = {
      totalConversations: conversationStore.size,
      sessionMessageCount: conversation ? conversation.messages.length : 0,
      sessionCreated: conversation ? new Date(conversation.createdAt).toISOString() : null,
      sessionLastActivity: conversation ? new Date(conversation.lastActivity).toISOString() : null,
      sessionId,
      timestamp: new Date().toISOString(),
    };
    
    logger.info('Retrieved chat statistics', { sessionId, stats });
    
    res.json(stats);
    
  } catch (error) {
    logger.error('Error retrieving chat statistics', {
      error: error.message,
      sessionId: req.sessionID,
    });
    
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = {
  sendMessage,
  getHistory,
  clearHistory,
  getSuggestions,
  getStats,
  cleanupOldConversations,
}; 