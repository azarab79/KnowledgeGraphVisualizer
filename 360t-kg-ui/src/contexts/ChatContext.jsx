import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, useMemo } from 'react';
import chatApiService from '../services/chatApiService';
import '../types/chat.js';

/**
 * Chat Context for managing all chat-related state and actions
 * Features:
 * - Centralized chat state management
 * - Debounced autosave functionality
 * - React 18 StrictMode double-mount protection
 * - Deep-link support with ?chatId=
 * - Error handling and loading states
 */

// Initial state
const initialState = {
  // Conversation list and current conversation
  conversations: [],
  currentConversation: null,
  conversationsLoaded: false,
  
  // Current chat history
  history: [],
  
  // UI states
  isLoading: false,
  error: null,
  
  // Autosave state
  autosaveInProgress: false,
  lastSaveTime: null,
};

// Action types
const CHAT_ACTIONS = {
  // Conversation management
  SET_CONVERSATIONS: 'SET_CONVERSATIONS',
  SET_CURRENT_CONVERSATION: 'SET_CURRENT_CONVERSATION',
  SET_CONVERSATIONS_LOADED: 'SET_CONVERSATIONS_LOADED',
  ADD_CONVERSATION: 'ADD_CONVERSATION',
  UPDATE_CONVERSATION: 'UPDATE_CONVERSATION',
  REMOVE_CONVERSATION: 'REMOVE_CONVERSATION',
  
  // Message management
  SET_HISTORY: 'SET_HISTORY',
  ADD_MESSAGE: 'ADD_MESSAGE',
  UPDATE_HISTORY: 'UPDATE_HISTORY',
  
  // UI states
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  
  // Autosave
  SET_AUTOSAVE_IN_PROGRESS: 'SET_AUTOSAVE_IN_PROGRESS',
  SET_LAST_SAVE_TIME: 'SET_LAST_SAVE_TIME',
};

// Reducer
const chatReducer = (state, action) => {
  switch (action.type) {
    case CHAT_ACTIONS.SET_CONVERSATIONS:
      return {
        ...state,
        conversations: action.payload,
      };
      
    case CHAT_ACTIONS.SET_CURRENT_CONVERSATION:
      return {
        ...state,
        currentConversation: action.payload,
      };
      
    case CHAT_ACTIONS.SET_CONVERSATIONS_LOADED:
      return {
        ...state,
        conversationsLoaded: action.payload,
      };
      
    case CHAT_ACTIONS.ADD_CONVERSATION:
      return {
        ...state,
        conversations: [action.payload, ...state.conversations],
      };
      
    case CHAT_ACTIONS.UPDATE_CONVERSATION:
      return {
        ...state,
        conversations: state.conversations.map(conv =>
          conv.id === action.payload.id ? { ...conv, ...action.payload } : conv
        ),
        currentConversation: state.currentConversation?.id === action.payload.id
          ? { ...state.currentConversation, ...action.payload }
          : state.currentConversation,
      };
      
    case CHAT_ACTIONS.REMOVE_CONVERSATION:
      return {
        ...state,
        conversations: state.conversations.filter(conv => conv.id !== action.payload),
        currentConversation: state.currentConversation?.id === action.payload 
          ? null 
          : state.currentConversation,
        history: state.currentConversation?.id === action.payload ? [] : state.history,
      };
      
    case CHAT_ACTIONS.SET_HISTORY:
      return {
        ...state,
        history: action.payload,
      };
      
    case CHAT_ACTIONS.ADD_MESSAGE:
      return {
        ...state,
        history: [...state.history, action.payload],
      };
      
    case CHAT_ACTIONS.UPDATE_HISTORY:
      return {
        ...state,
        history: action.payload,
      };
      
    case CHAT_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };
      
    case CHAT_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
      };
      
    case CHAT_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };
      
    case CHAT_ACTIONS.SET_AUTOSAVE_IN_PROGRESS:
      return {
        ...state,
        autosaveInProgress: action.payload,
      };
      
    case CHAT_ACTIONS.SET_LAST_SAVE_TIME:
      return {
        ...state,
        lastSaveTime: action.payload,
      };
      
    default:
      return state;
  }
};

// Create two separate contexts
const ChatStateContext = createContext(initialState);
const ChatActionsContext = createContext(null);

// Custom hooks to access the contexts
export const useChatState = () => {
  const context = useContext(ChatStateContext);
  if (!context) throw new Error('useChatState must be used within a ChatProvider');
  return context;
};

export const useChatActions = () => {
  const context = useContext(ChatActionsContext);
  if (!context) throw new Error('useChatActions must be used within a ChatProvider');
  return context;
};

// Selectors - use useMemo to prevent recreating functions on every render
export const useChatSelectors = () => {
  const state = useChatState();
  
  return React.useMemo(() => ({
    // Basic selectors
    getCurrentConversation: () => state.currentConversation,
    getConversations: () => state.conversations,
    getHistory: () => state.history,
    getIsLoading: () => state.isLoading,
    getError: () => state.error,
    getConversationsLoaded: () => state.conversationsLoaded,
    
    // Computed selectors
    getHasMessages: () => state.history.length > 0,
    getIsFirstUserMessage: () => state.history.filter(m => m.role === 'user').length === 0,
    getCanSave: () => state.currentConversation && state.history.length > 0,
    getLastMessage: () => state.history[state.history.length - 1] || null,
  }), [state]);
};

// Provider component
export const ChatProvider = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  
  const autosaveTimeoutRef = useRef(null);
  const initializationRef = useRef({ hasInitialized: false, isInitializing: false });
  const consecutiveFailuresRef = useRef(0);

  // All actions are wrapped in useCallback to stabilize their references
  const debouncedAutosave = useCallback(async (conversationId, history, name = null) => {
    // Clear existing timeout
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    
    // Set new timeout for 1.2 seconds
    autosaveTimeoutRef.current = setTimeout(async () => {
      if (!conversationId || !history || history.length === 0) return;
      
      try {
        dispatch({ type: CHAT_ACTIONS.SET_AUTOSAVE_IN_PROGRESS, payload: true });
        
        await chatApiService.saveConversation(conversationId, history, name);
        
        dispatch({ type: CHAT_ACTIONS.SET_LAST_SAVE_TIME, payload: new Date().toISOString() });
        consecutiveFailuresRef.current = 0;
        
        // Emit autosave success event for analytics
        window.dispatchEvent(new CustomEvent('chat_autosave_success', {
          detail: { conversationId, messageCount: history.length }
        }));
        
      } catch (error) {
        consecutiveFailuresRef.current += 1;
        console.error('Autosave failed:', error);
        
        // Stop autosave after 3 consecutive failures
        if (consecutiveFailuresRef.current >= 3) {
          dispatch({ 
            type: CHAT_ACTIONS.SET_ERROR, 
            payload: 'Autosave has failed multiple times. Please save manually.' 
          });
        }
      } finally {
        dispatch({ type: CHAT_ACTIONS.SET_AUTOSAVE_IN_PROGRESS, payload: false });
      }
    }, 1200);
  }, []);

  const loadConversations = useCallback(async () => {
    if (initializationRef.current.isInitializing || initializationRef.current.hasInitialized) return;
    initializationRef.current.isInitializing = true;
    dispatch({ type: CHAT_ACTIONS.SET_LOADING, payload: true });
    try {
      const conversations = await chatApiService.getConversations();
      dispatch({ type: CHAT_ACTIONS.SET_CONVERSATIONS, payload: conversations });
      dispatch({ type: CHAT_ACTIONS.SET_CONVERSATIONS_LOADED, payload: true });
      initializationRef.current.hasInitialized = true;
    } catch (error) {
      dispatch({ type: CHAT_ACTIONS.SET_ERROR, payload: 'Failed to load conversation list.' });
    } finally {
      dispatch({ type: CHAT_ACTIONS.SET_LOADING, payload: false });
      initializationRef.current.isInitializing = false;
    }
  }, []);

  const selectConversation = useCallback(async (conversationId) => {
    if (!conversationId) return;
    
    try {
      dispatch({ type: CHAT_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: CHAT_ACTIONS.CLEAR_ERROR });
      
      const conversation = await chatApiService.getConversation(conversationId);
      dispatch({ type: CHAT_ACTIONS.SET_CURRENT_CONVERSATION, payload: conversation });
      dispatch({ type: CHAT_ACTIONS.SET_HISTORY, payload: conversation.history || [] });
      
      // Update URL for deep-linking (safe for test environment)
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('chatId', conversationId);
        window.history?.replaceState?.({}, '', url.toString());
      } catch (urlError) {
        // Ignore URL errors in test environment
        console.warn('URL update failed:', urlError.message);
      }
      
    } catch (error) {
      console.error('Failed to load conversation:', error);
      dispatch({ 
        type: CHAT_ACTIONS.SET_ERROR, 
        payload: `Failed to load conversation: ${error.message}` 
      });
    } finally {
      dispatch({ type: CHAT_ACTIONS.SET_LOADING, payload: false });
    }
  }, []);

  const createNewConversation = useCallback(async () => {
    try {
      dispatch({ type: CHAT_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: CHAT_ACTIONS.CLEAR_ERROR });
      
      const newConversation = await chatApiService.createConversation('New Chat');
      dispatch({ type: CHAT_ACTIONS.ADD_CONVERSATION, payload: newConversation });
      dispatch({ type: CHAT_ACTIONS.SET_CURRENT_CONVERSATION, payload: newConversation });
      dispatch({ type: CHAT_ACTIONS.SET_HISTORY, payload: newConversation.history || [] });
      
      // Update URL for deep-linking (safe for test environment)
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('chatId', newConversation.id);
        window.history?.replaceState?.({}, '', url.toString());
      } catch (urlError) {
        // Ignore URL errors in test environment
        console.warn('URL update failed:', urlError.message);
      }
      
    } catch (error) {
      console.error('Failed to create new conversation:', error);
      dispatch({ 
        type: CHAT_ACTIONS.SET_ERROR, 
        payload: `Failed to create new chat: ${error.message}` 
      });
    } finally {
      dispatch({ type: CHAT_ACTIONS.SET_LOADING, payload: false });
    }
  }, []);
  
  const deleteConversation = useCallback(async (conversationId) => {
    if (!conversationId || !window.confirm('Are you sure you want to delete this conversation?')) {
      return;
    }
    
    try {
      dispatch({ type: CHAT_ACTIONS.SET_LOADING, payload: true });
      
      await chatApiService.deleteConversation(conversationId);
      dispatch({ type: CHAT_ACTIONS.REMOVE_CONVERSATION, payload: conversationId });
      
      // Clear URL if this was the current conversation (safe for test environment)
      try {
        const currentUrl = new URL(window.location.href);
        const currentChatId = currentUrl.searchParams.get('chatId');
        if (currentChatId === conversationId) {
          currentUrl.searchParams.delete('chatId');
          window.history?.replaceState?.({}, '', currentUrl.toString());
        }
      } catch (urlError) {
        // Ignore URL errors in test environment
        console.warn('URL update failed:', urlError.message);
      }
      
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      dispatch({ 
        type: CHAT_ACTIONS.SET_ERROR, 
        payload: `Failed to delete conversation: ${error.message}` 
      });
    } finally {
      dispatch({ type: CHAT_ACTIONS.SET_LOADING, payload: false });
    }
  }, []);

  const sendMessage = useCallback(async (message) => {
    const { currentConversation, history } = state;
    if (!message?.trim() || !currentConversation) {
        if (!currentConversation) dispatch({ type: CHAT_ACTIONS.SET_ERROR, payload: 'No conversation selected' });
        return;
    }
    
    const userMessage = {
      role: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString()
    };
    
    dispatch({ type: CHAT_ACTIONS.ADD_MESSAGE, payload: userMessage });
    dispatch({ type: CHAT_ACTIONS.SET_LOADING, payload: true });
    dispatch({ type: CHAT_ACTIONS.CLEAR_ERROR });

    try {
      const currentHistory = [...history, userMessage];
      
      const response = await chatApiService.sendMessage(message.trim(), currentHistory);
      
      const assistantMessage = response.updatedHistory[response.updatedHistory.length - 1];
      
      dispatch({ type: CHAT_ACTIONS.ADD_MESSAGE, payload: assistantMessage });

      const isFirstUserMessage = history.filter(m => m.role === 'user').length === 0;
      
      if (isFirstUserMessage) {
        const newName = message.substring(0, 50);
        const updatedConversation = { ...currentConversation, name: newName };
        dispatch({ type: CHAT_ACTIONS.UPDATE_CONVERSATION, payload: updatedConversation });
        debouncedAutosave(currentConversation.id, [...currentHistory, assistantMessage], newName);
      } else {
        debouncedAutosave(currentConversation.id, [...currentHistory, assistantMessage]);
      }
      
    } catch (error) {
      console.error('Failed to send message:', error);
      
      const errorMessage = {
        role: 'assistant',
        content: "Error: I couldn't send your message. Please try again.",
        timestamp: new Date().toISOString()
      };
      dispatch({ type: CHAT_ACTIONS.ADD_MESSAGE, payload: errorMessage });
      dispatch({ type: CHAT_ACTIONS.SET_ERROR, payload: `Send failed: ${error.message}` });
    } finally {
      dispatch({ type: CHAT_ACTIONS.SET_LOADING, payload: false });
    }
  }, [state.currentConversation, state.history, debouncedAutosave]);

  const clearError = useCallback(() => dispatch({ type: CHAT_ACTIONS.CLEAR_ERROR }), []);

  const actions = useMemo(() => ({
    loadConversations,
    selectConversation,
    createNewConversation,
    deleteConversation,
    sendMessage,
    clearError,
  }), [loadConversations, selectConversation, createNewConversation, deleteConversation, sendMessage, clearError]);

  // Handle URL-based conversation loading when conversations are loaded
  useEffect(() => {
    if (!state.conversationsLoaded) return;
    
    let chatId = null;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      chatId = urlParams.get('chatId');
    } catch (urlError) {
      // Ignore URL parsing errors in test environment
      console.warn('URL parsing failed:', urlError.message);
    }
    
    if (chatId && chatId !== state.currentConversation?.id) {
      actions.selectConversation(chatId);
    } else if (!state.currentConversation && state.conversations.length > 0) {
      // If no conversation is selected but conversations exist, select the first one
      actions.selectConversation(state.conversations[0].id);
    } else if (state.conversations.length === 0) {
      // Create a new conversation if none exist
      actions.createNewConversation();
    }
  }, [state.conversationsLoaded, state.conversations.length, state.currentConversation?.id, actions.selectConversation, actions.createNewConversation]);
  
  // Initialize conversations on mount
  useEffect(() => {
    if (!initializationRef.current.hasInitialized && !initializationRef.current.isInitializing) {
      actions.loadConversations();
    }
  }, []); // Only run once on mount
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);
  
  return (
    <ChatStateContext.Provider value={state}>
      <ChatActionsContext.Provider value={actions}>
        {children}
      </ChatActionsContext.Provider>
    </ChatStateContext.Provider>
  );
};

// The provider should be the default export
export default ChatProvider; 