import React from 'react';

const LegendToggle = ({ onClick }) => (
  <button
    onClick={onClick}
    style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: '#00973A',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      padding: '6px 12px',
      fontSize: '12px',
      cursor: 'pointer',
      zIndex: 99,
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    }}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 5H21V7H3V5ZM3 11H21V13H3V11ZM3 17H21V19H3V17Z" fill="currentColor"/>
    </svg>
    Show Legend
  </button>
);

export default LegendToggle;
