/**
 * @fileoverview Type definitions for chat-related objects and interfaces
 */

/**
 * @typedef {Object} SourceDocument
 * @property {string} id - Unique identifier for the document
 * @property {string} title - Display title of the document
 * @property {string} preview - Preview text from the document
 * @property {string} [content] - Full content of the document (optional)
 * @property {string} [url] - URL to the document (optional)
 * @property {number} [score] - Relevance score (optional)
 */

/**
 * @typedef {Object} SourceNode
 * @property {string} id - Unique identifier for the graph node
 * @property {string} name - Display name of the node
 * @property {string[]} labels - Array of node labels/types from Neo4j
 */

/**
 * @typedef {Object} ChatMessage
 * @property {('user'|'assistant')} role - Role of the message sender
 * @property {string} content - The message content/text
 * @property {string} timestamp - ISO timestamp when the message was created
 * @property {SourceDocument[]} [sourceDocuments] - Array of source documents referenced in assistant messages
 * @property {SourceNode[]} [sourceNodes] - Array of source nodes referenced in assistant messages
 * @property {string} [messageId] - Unique identifier for the message (optional)
 * @property {Object} [metadata] - Additional metadata (optional)
 */

/**
 * @typedef {Object} Conversation
 * @property {string} id - Unique identifier for the conversation
 * @property {string} name - Display name for the conversation
 * @property {string} createdAt - ISO timestamp when conversation was created
 * @property {ChatMessage[]} history - Array of messages in the conversation
 * @property {number} [messageCount] - Number of messages (optional, for list views)
 */

/**
 * @typedef {Object} ChatApiResponse
 * @property {ChatMessage} response - The assistant message response
 * @property {ChatMessage[]} updatedHistory - Complete updated conversation history
 */

/**
 * @typedef {Object} SendMessageOptions
 * @property {string} message - The user's message to send
 * @property {ChatMessage[]} [history] - Current conversation history
 * @property {string} [requestId] - Unique identifier for request cancellation
 */

/**
 * @typedef {Object} ChatState
 * @property {ChatMessage[]} history - Current conversation history
 * @property {boolean} loading - Whether a request is in progress
 * @property {string|null} error - Current error message, if any
 * @property {Conversation[]} conversations - List of saved conversations
 * @property {Conversation|null} currentConversation - Currently selected conversation
 * @property {boolean} conversationsLoaded - Whether conversations have been loaded from server
 * @property {boolean} autosaveInProgress - Whether autosave is currently running
 * @property {string|null} lastSaveTime - ISO timestamp of last successful save
 */

/**
 * @typedef {Object} ChatActions
 * @property {function(): Promise<void>} loadConversations - Load conversations from server
 * @property {function(string): Promise<void>} selectConversation - Select a conversation by ID
 * @property {function(): Promise<void>} createNewConversation - Create a new conversation
 * @property {function(string): Promise<void>} deleteConversation - Delete a conversation by ID
 * @property {function(string): Promise<void>} sendMessage - Send a message to the chat
 * @property {function(): void} clearError - Clear the current error state
 */

/**
 * @typedef {Object} ChatContextValue
 * @property {ChatState} state - Current chat state
 * @property {ChatActions} actions - Available chat actions
 */

// Export types for use in JSDoc comments throughout the application
export {}; 