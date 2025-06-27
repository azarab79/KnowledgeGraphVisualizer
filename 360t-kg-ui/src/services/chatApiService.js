import axios from 'axios';
import '../types/chat.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

const chatApi = axios.create({
  baseURL: `${API_URL}/chat`,
  timeout: 50000, // 50 second timeout for LLM processing
});

// Map to track active requests for cancellation
const activeRequests = new Map();

/**
 * Implements retry logic for failed requests with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Initial delay in milliseconds
 * @returns {Promise} Result of the function or throws error after all retries
 */
const retryWithBackoff = async (fn, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry for certain error types
      if (error.response?.status === 400 || error.response?.status === 401 || error.response?.status === 403) {
        throw error;
      }
      
      // Don't retry if this was a cancellation
      if (axios.isCancel(error)) {
        throw error;
      }
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        break;
      }
      
      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
    }
  }
  
  throw lastError;
};

/**
 * Sends a message to the backend with retry logic and cancellation support.
 * @param {string} message - The user's message.
 * @param {ChatMessage[]} history - The current conversation history.
 * @param {string} requestId - Unique identifier for this request (for cancellation)
 * @returns {Promise<ChatApiResponse>} The API response containing the new message and updated history.
 */
export const sendMessage = async (message, history = [], requestId = null) => {
  // Create cancellation token
  const cancelToken = axios.CancelToken.source();
  
  // Store the cancellation token if requestId is provided
  if (requestId) {
    // Cancel any existing request with the same ID
    if (activeRequests.has(requestId)) {
      activeRequests.get(requestId).cancel('Request superseded by new request');
    }
    activeRequests.set(requestId, cancelToken);
  }
  
  try {
    const response = await retryWithBackoff(async () => {
      return await chatApi.post('/message', 
        { message, history }, 
        { cancelToken: cancelToken.token }
      );
    });
    
    // Clean up the active request
    if (requestId) {
      activeRequests.delete(requestId);
    }
    
    // Extract source documents and nodes from response and add them to the assistant message
    const responseData = response.data;
    
    // Enhanced fix: Handle multiple possible response structures for robust data extraction
    const sourceDocuments = responseData.sourceDocuments || responseData.response?.sourceDocuments || [];
    const sourceNodes = responseData.sourceNodes || responseData.response?.sourceNodes || [];
    
    // Ensure source documents and nodes are accessible at the expected level
    if (responseData.response && typeof responseData.response === 'object') {
      // Add source data to the response object for backward compatibility
      responseData.response.sourceDocuments = sourceDocuments;
      responseData.response.sourceNodes = sourceNodes;
    }
    
    // Also ensure data is available at the top level for future API changes
    responseData.sourceDocuments = sourceDocuments;
    responseData.sourceNodes = sourceNodes;
    
    return responseData;
  } catch (error) {
    // Clean up the active request on error
    if (requestId) {
      activeRequests.delete(requestId);
    }
    
    // Handle different error types
    if (axios.isCancel(error)) {
      throw new Error('Request was cancelled');
    }
    
    // Only log in development mode
    if (import.meta.env.DEV) {
      console.error('Error sending message:', error);
    }
    
    // Provide user-friendly error messages
    if (error.response) {
      const status = error.response.status;
      const errorMessage = error.response.data?.error || error.response.data?.message;
      
      switch (status) {
        case 400:
          throw new Error(errorMessage || 'Invalid message format');
        case 429:
          throw new Error('Too many requests. Please wait a moment and try again.');
        case 500:
          throw new Error('Server error. Please try again later.');
        case 503:
          throw new Error('Service temporarily unavailable. Please try again later.');
        default:
          throw new Error(errorMessage || `Request failed with status ${status}`);
      }
    } else if (error.request) {
      throw new Error('Unable to connect to the chat service. Please check your connection.');
    } else {
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
};

/**
 * Cancels an active request by its ID
 * @param {string} requestId - The ID of the request to cancel
 */
export const cancelRequest = (requestId) => {
  if (activeRequests.has(requestId)) {
    activeRequests.get(requestId).cancel('Request cancelled by user');
    activeRequests.delete(requestId);
  }
};

/**
 * Fetches the list of all saved conversations.
 * @returns {Promise<Array>} A list of conversation metadata objects.
 */
export const getConversations = async () => {
  try {
    const response = await retryWithBackoff(() => chatApi.get('/conversations'));
    return response.data || [];
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error fetching conversations:', error);
    }
    throw new Error('Failed to fetch conversation list.');
  }
};

/**
 * Creates a new, empty conversation on the server.
 * @param {string} name - An optional name for the new conversation.
 * @returns {Promise<Object>} The new conversation object.
 */
export const createConversation = async (name = '') => {
  try {
    const response = await retryWithBackoff(() => chatApi.post('/conversations', { name }));
    return response.data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error creating conversation:', error);
    }
    throw new Error('Failed to create a new conversation.');
  }
};

/**
 * Fetches a single conversation and its full history.
 * @param {string} id - The ID of the conversation to fetch.
 * @returns {Promise<Object>} The full conversation object including history.
 */
export const getConversation = async (id) => {
  if (!id) throw new Error('Conversation ID is required.');
  try {
    const response = await retryWithBackoff(() => chatApi.get(`/conversations/${id}`));
    return response.data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(`Error fetching conversation ${id}:`, error);
    }
    throw new Error('Failed to load conversation.');
  }
};

/**
 * Saves the history of a conversation.
 * @param {string} id - The ID of the conversation to save.
 * @param {Array} history - The array of message objects to save.
 * @param {string} [name] - The optional new name for the conversation.
 * @returns {Promise<Object>} A confirmation message.
 */
export const saveConversation = async (id, history, name = null) => {
  if (!id) throw new Error('Conversation ID is required to save.');
  try {
    const payload = { history };
    if (name) {
      payload.name = name;
    }
    const response = await retryWithBackoff(() => chatApi.put(`/conversations/${id}`, payload));
    return response.data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(`Error saving conversation ${id}:`, error);
    }
    throw new Error('Failed to save conversation.');
  }
};

/**
 * Deletes a conversation from the server.
 * @param {string} id - The ID of the conversation to delete.
 * @returns {Promise<Object>} A confirmation message.
 */
export const deleteConversation = async (id) => {
  if (!id) throw new Error('Conversation ID is required for deletion.');
  try {
    const response = await retryWithBackoff(() => chatApi.delete(`/conversations/${id}`));
    return response.data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(`Error deleting conversation ${id}:`, error);
    }
    throw new Error('Failed to delete conversation.');
  }
};

/**
 * Fetches the conversation history with retry logic.
 * @deprecated Use getConversations and getConversation instead
 * @returns {Promise<Array>} The conversation history.
 */
export const getConversationHistory = async () => {
  try {
    const response = await retryWithBackoff(async () => {
      return await chatApi.get('/history');
    });
    
    return response.data.history || [];
  } catch (error) {
    // Only log in development mode
    if (import.meta.env.DEV) {
      console.error('Error fetching conversation history:', error);
    }
    
    if (error.response?.status === 404) {
      // If no history exists, return empty array
      return [];
    }
    
    throw new Error('Failed to fetch conversation history. Please try again.');
  }
};

/**
 * Clears the conversation history on the server with retry logic.
 * @deprecated Use deleteConversation instead
 * @returns {Promise<Object>} The confirmation message.
 */
export const clearConversationHistory = async () => {
  try {
    const response = await retryWithBackoff(async () => {
      return await chatApi.delete('/history');
    });
    
    return response.data;
  } catch (error) {
    // Only log in development mode
    if (import.meta.env.DEV) {
      console.error('Error clearing conversation history:', error);
    }
    throw new Error('Failed to clear conversation history. Please try again.');
  }
};

const chatApiService = {
  sendMessage,
  getConversations,
  createConversation,
  getConversation,
  saveConversation,
  deleteConversation,
  cancelRequest,
};

export default chatApiService; 