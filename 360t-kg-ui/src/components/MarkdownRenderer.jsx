import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import '../styles/MarkdownRenderer.css';

/**
 * MarkdownRenderer component for rendering markdown content safely
 * Features:
 * - Parses markdown to HTML using marked
 * - Sanitizes HTML content using DOMPurify
 * - Custom styling for better readability
 * - Support for code blocks, lists, headers, etc.
 * - Emoji rendering support
 * - Clickable related questions
 */
function MarkdownRenderer({ content, className = '', onSendMessage }) {
  const contentRef = useRef(null);

  if (!content) {
    return null;
  }

  // Configure marked options for better rendering
  marked.setOptions({
    breaks: false, // Disable automatic <br> for single line breaks
    gfm: true, // GitHub Flavored Markdown
    sanitize: false, // We'll use DOMPurify for sanitization
    smartLists: true,
    smartypants: true,
    headerIds: false, // Disable header IDs to avoid conflicts
    mangle: false, // Disable email mangling
  });

  // Convert markdown to HTML
  const rawMarkup = marked.parse(content);
  
  // Sanitize the HTML to prevent XSS attacks
  const sanitizedMarkup = DOMPurify.sanitize(rawMarkup, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'strike', 'del', 'ins',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote',
      'code', 'pre',
      'a',
      'img',
      'hr',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span'
    ],
    ALLOWED_ATTR: [
      'href', 'title', 'target', 'rel',
      'src', 'alt', 'width', 'height',
      'class', 'id',
      'align'
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_SCRIPT: true,
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['style', 'onload', 'onerror', 'onclick']
  });

  // Effect to add click handlers to related questions after render
  useEffect(() => {
    if (!contentRef.current || !onSendMessage) return;

    const addClickHandlers = () => {
      // Find all list items that look like questions (start with "- " and end with "?")
      const listItems = contentRef.current.querySelectorAll('li');
      
      listItems.forEach((li) => {
        const text = li.textContent.trim();
        
        // Check if this looks like a question (ends with ?) and isn't already processed
        if (text.endsWith('?') && !li.dataset.clickHandlerAdded) {
          // Mark as processed to prevent duplicate handlers
          li.dataset.clickHandlerAdded = 'true';
          
          // Add clickable styling and click handler
          li.style.cursor = 'pointer';
          li.style.color = '#0366d6';
          li.style.padding = '0.15em 0.3em';
          li.style.borderRadius = '4px';
          li.style.transition = 'all 0.2s ease';
          li.style.margin = '0.05em 0';
          li.style.border = '1px solid transparent';
          li.className = 'related-question';
          
          // Create event handlers as named functions to ensure proper cleanup
          const handleMouseEnter = () => {
            li.style.backgroundColor = '#f1f8ff';
            li.style.borderColor = '#c8e1ff';
            li.style.color = '#0253aa';
          };
          
          const handleMouseLeave = () => {
            li.style.backgroundColor = 'transparent';
            li.style.borderColor = 'transparent';
            li.style.color = '#0366d6';
          };
          
          const handleClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // Prevent multiple rapid clicks
            if (li.dataset.clicking === 'true') {
              return;
            }
            li.dataset.clicking = 'true';
            
            // Extract just the question text, removing any leading dashes or formatting
            let questionText = text.replace(/^[-*]\s*/, '').trim();
            
            // Add visual feedback
            li.style.backgroundColor = '#cce8ff';
            li.style.transform = 'translateY(1px)';
            
            // Send the question after a short delay to show visual feedback
            setTimeout(() => {
              onSendMessage(questionText);
              
              // Reset visual state
              setTimeout(() => {
                li.style.backgroundColor = 'transparent';
                li.style.transform = 'translateY(0)';
                li.dataset.clicking = 'false';
              }, 150);
            }, 50);
          };
          
          // Add event listeners
          li.addEventListener('mouseenter', handleMouseEnter, { passive: true });
          li.addEventListener('mouseleave', handleMouseLeave, { passive: true });
          li.addEventListener('click', handleClick, { once: false });
          
          // Store references for cleanup
          li._eventHandlers = {
            mouseenter: handleMouseEnter,
            mouseleave: handleMouseLeave,
            click: handleClick
          };
        }
      });

      // Also look for questions in the "Related Questions" section specifically
      const headings = contentRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6');
      
      headings.forEach((heading) => {
        const headingText = heading.textContent.toLowerCase();
        
        // If this is a "Related Questions" heading, mark the following list as special
        if (headingText.includes('related question') || headingText.includes('💡')) {
          let nextElement = heading.nextElementSibling;
          
          while (nextElement) {
            if (nextElement.tagName === 'UL' || nextElement.tagName === 'OL') {
              nextElement.classList.add('related-questions-section');
              break;
            } else if (nextElement.tagName.match(/^H[1-6]$/)) {
              // Stop if we hit another heading
              break;
            }
            nextElement = nextElement.nextElementSibling;
          }
        }
      });
    };

    // Add click handlers after a brief delay to ensure DOM is ready
    const timeoutId = setTimeout(addClickHandlers, 10);
    
    // Cleanup function to remove event listeners
    return () => {
      clearTimeout(timeoutId);
      if (contentRef.current) {
        const questions = contentRef.current.querySelectorAll('.related-question');
        questions.forEach((q) => {
          // Remove event listeners properly
          if (q._eventHandlers) {
            q.removeEventListener('mouseenter', q._eventHandlers.mouseenter);
            q.removeEventListener('mouseleave', q._eventHandlers.mouseleave);
            q.removeEventListener('click', q._eventHandlers.click);
            delete q._eventHandlers;
          }
          // Remove our data attributes
          delete q.dataset.clickHandlerAdded;
          delete q.dataset.clicking;
        });
      }
    };
  }, [sanitizedMarkup, onSendMessage]);

  return (
    <div 
      ref={contentRef}
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedMarkup }}
    />
  );
}

export default MarkdownRenderer; 