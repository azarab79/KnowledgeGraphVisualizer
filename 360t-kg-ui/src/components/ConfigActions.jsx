import React from 'react';

const ConfigActions = ({ onExport, onImport, onReset }) => (
  <div style={{
    position: 'fixed',
    bottom: '20px',
    left: '20px',
    zIndex: 99,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  }}>
    <button
      onClick={onExport}
      style={{
        backgroundColor: '#00973A',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        padding: '6px 12px',
        fontSize: '12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '5px'
      }}
    >
      Export Config
    </button>
    <label
      style={{
        backgroundColor: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        padding: '6px 12px',
        fontSize: '12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        textAlign: 'center'
      }}
    >
      Import Config
      <input 
        type="file" 
        accept=".json"
        style={{ display: 'none' }}
        onChange={onImport}
      />
    </label>
    <button
      onClick={onReset}
      style={{
        backgroundColor: '#ef4444',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        padding: '6px 12px',
        fontSize: '12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '5px'
      }}
    >
      Reset Config
    </button>
  </div>
);

export default ConfigActions;
