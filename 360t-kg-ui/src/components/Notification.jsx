import React, { useEffect } from 'react';

const Notification = ({ message, type = 'info', onClose, autoClose = true, duration = 5000 }) => {
    // Auto-close the notification after the specified duration
    useEffect(() => {
        if (message && autoClose) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            
            return () => {
                clearTimeout(timer);
            };
        }
    }, [message, autoClose, duration, onClose]);
    
    if (!message) return null;
    
    return (
        <div className={`notification notification-${type}`}>
            <div className="notification-content">
                {type === 'error' && <span className="notification-icon">⚠️</span>}
                {type === 'success' && <span className="notification-icon">✅</span>}
                {type === 'info' && <span className="notification-icon">ℹ️</span>}
                <span className="notification-message">{message}</span>
            </div>
            <button 
                className="notification-close"
                onClick={onClose}
                aria-label="Close notification"
            >
                ✕
            </button>
        </div>
    );
};

export default Notification; 