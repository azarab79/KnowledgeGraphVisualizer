const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        // Write all logs to console
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        // Write all logs with level 'info' and below to combined.log
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/combined.log'),
            level: 'info'
        }),
        // Write all errors to error.log
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/error.log'),
            level: 'error'
        })
    ],
    // Handle uncaught exceptions and unhandled rejections
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/exceptions.log')
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/rejections.log')
        })
    ]
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Export logger instance
module.exports = logger; 