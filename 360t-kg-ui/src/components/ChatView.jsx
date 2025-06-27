import React, { useState, useRef, useEffect } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import MessageReferences from './MessageReferences';
import { useChatState, useChatActions, useChatSelectors } from '../contexts/ChatContext';
import '../styles/ChatView.css';

/**
 * ChatView component for displaying chat conversation interface
 * Features:
 * - Message history display with user/assistant distinction
 * - Input field with send button
 * - Loading indicators for ongoing requests
 * - Auto-scroll to latest messages
 * - Clear conversation functionality
 * - Source document and node references with tabbed interface
 * - Responsive design
 * - Now uses ChatContext for centralized state management
 */
function ChatView({
  placeholder = "Ask me anything about the knowledge graph...",
  onNodeSelect
}) {
  // Get state and actions from ChatContext
  const state = useChatState();
  const actions = useChatActions();
  const selectors = useChatSelectors();

  // Local state for input only
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Auto-focus the input when the conversation changes
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [state.currentConversation?.id]);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.history]);

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedMessage = inputMessage.trim();
    
    if (!trimmedMessage || state.isLoading) return;
    
    // Send message using context
    actions.sendMessage(trimmedMessage);
    
    // Clear input
    setInputMessage('');
  };

  // Handle input key press (Enter to send, Shift+Enter for new line)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent default to avoid form submitting twice
      
      const trimmedMessage = inputMessage.trim();
      if (!trimmedMessage || state.isLoading) return;

      actions.sendMessage(trimmedMessage);
      setInputMessage('');
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-view">
      <div className="chat-header">
        <div className="chat-controls">
          <select 
            className="conversation-selector" 
            value={state.currentConversation?.id || ''} 
            onChange={(e) => actions.selectConversation(e.target.value)}
            disabled={state.isLoading}
          >
            {state.conversations.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button 
            onClick={actions.createNewConversation} 
            title="New Chat" 
            className="new-chat-button"
            disabled={state.isLoading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button 
            onClick={() => actions.deleteConversation(state.currentConversation?.id)} 
            title="Delete Chat" 
            className="delete-button" 
            disabled={state.isLoading || !state.currentConversation}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3,6 5,6 21,6"></polyline>
              <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Error Display */}
      {state.error && (
        <div className="chat-error">
          <span className="error-message">{state.error}</span>
        </div>
      )}

      {/* Messages Container */}
      <div className="messages-container">
        {state.history.length === 0 ? (
          <div className="empty-state">
            <h4>No Messages</h4>
            <p>Start a conversation by typing a message below.</p>
          </div>
        ) : (
          <div className="messages-list">
            {state.history.map((message, index) => (
              <div key={index} className={`message ${message.role}`}>
                <div className="message-content">
                  <div className="message-header">
                    <span className="message-role">
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </span>
                    {message.timestamp && (
                      <span className="message-timestamp">
                        {formatTimestamp(message.timestamp)}
                      </span>
                    )}
                  </div>
                  <div className="message-text">
                    {message.role === 'assistant' ? (
                      <MarkdownRenderer 
                        content={message.content} 
                        onSendMessage={actions.sendMessage}
                      />
                    ) : (
                      message.content
                    )}
                  </div>
                  
                  {/* Always show MessageReferences for assistant messages to ensure consistent behavior */}
                  {message.role === 'assistant' && (
                    <MessageReferences 
                      sourceDocuments={message.sourceDocuments || []}
                      sourceNodes={message.sourceNodes || []}
                      messageRole={message.role}
                      onNodeSelect={(selectedNode) => {
                        if (onNodeSelect) {
                          // NodeChip now passes the full node object directly
                          onNodeSelect(selectedNode);
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
            
            {state.isLoading && (
              <div className="message assistant loading">
                <div className="message-content">
                  <div className="message-header">
                    <span className="message-role">Assistant</span>
                  </div>
                  <div className="message-text">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className="chat-input-container">
        <form onSubmit={handleSubmit} className="chat-form">
          <div className="input-wrapper">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows="1"
              className="chat-input"
              disabled={state.isLoading}
            />
            <button 
              type="submit" 
              className="send-button"
              disabled={!inputMessage.trim() || state.isLoading}
              title="Send message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChatView; 