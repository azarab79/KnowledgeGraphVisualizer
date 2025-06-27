import React from 'react';
import * as d3 from 'd3';
import { getInitialGraph } from '../services/api';
import '../styles/360t-theme.css';
import logo from '../assets/logos/360T-logo.png';

/**
 * Header component with logo, title and main navigation
 */
function Header({ currentView, onSwitchView }) {
  // Enhanced cleanup function for tooltips
  const cleanupTooltips = () => {
    // Remove all D3 tooltips
    d3.select("body").selectAll(".document-tooltip").remove();
    // Remove React tooltips  
    document.querySelectorAll('.custom-tooltip, .node-chip-tooltip').forEach(el => el.remove());
  };

  const handleNavClick = (view) => {
    // Clean up tooltips before switching views
    cleanupTooltips();
    
    if (onSwitchView) {
      onSwitchView(view);
      
      // For explorer view, also trigger initial graph loading
      // This ensures the full graph is displayed when switching to explorer
      if (view === 'explorer') {
        // Use a delay to ensure the view state is updated first
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('loadInitialGraph'));
        }, 100);
      }
    } else {
      // Fallback for standalone use (optional)
      let eventName;
      switch (view) {
        case 'explorer':
          eventName = 'loadInitialGraph';
          break;
        case 'analysis':
          eventName = 'showAnalysis';
          break;
        case 'documentation':
          eventName = 'showDocumentation';
          break;
        case 'chat':
          eventName = 'showChat';
          break;
        default:
          return;
      }
      window.dispatchEvent(new CustomEvent(eventName));
    }
  };

  return (
    <header className="app-header">
      <div className="logo-container">
        <img src={logo} alt="360T Logo" className="app-logo" style={{height: '40px', width: 'auto'}} />
        <h1>Knowledge Graph</h1>
      </div>
      <nav className="main-nav">
        <ul>
          <li><button className={`nav-button ${currentView === 'explorer' ? 'active' : ''}`} onClick={() => handleNavClick('explorer')}>Explorer</button></li>
          <li><button className={`nav-button ${currentView === 'analysis' ? 'active' : ''}`} onClick={() => handleNavClick('analysis')}>Analysis</button></li>
          <li><button className={`nav-button ${currentView === 'chat' ? 'active' : ''}`} onClick={() => handleNavClick('chat')}>Chat</button></li>
          <li><button className={`nav-button ${currentView === 'documentation' ? 'active' : ''}`} onClick={() => handleNavClick('documentation')}>Documentation</button></li>
        </ul>
      </nav>
      <div className="user-controls">
        <button className="icon-button" title="Settings">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
        <button className="icon-button" title="Help">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </button>
      </div>
    </header>
  );
}

export default Header; 