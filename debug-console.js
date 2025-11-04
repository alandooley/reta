// Debug script to catch and preserve console errors
// Paste this into your browser console when testing app-new.html

console.log('🔍 Debug logger activated - all errors will be preserved');

// Store all logs
window.debugLogs = [];

// Override console.error
const originalError = console.error;
console.error = function(...args) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        type: 'error',
        message: args.join(' ')
    };
    window.debugLogs.push(logEntry);
    console.log(`[${timestamp}] ERROR:`, ...args);
    originalError.apply(console, args);
};

// Override console.log
const originalLog = console.log;
console.log = function(...args) {
    const timestamp = new Date().toISOString();
    const message = args.join(' ');

    // Capture important messages
    if (message.includes('Error') ||
        message.includes('Auth') ||
        message.includes('undefined') ||
        message.includes('Failed') ||
        message.includes('Cannot read')) {
        const logEntry = {
            timestamp,
            type: 'log',
            message
        };
        window.debugLogs.push(logEntry);
    }

    originalLog.apply(console, args);
};

// Capture unhandled promise rejections
window.addEventListener('unhandledrejection', event => {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        type: 'unhandledRejection',
        message: event.reason?.message || event.reason
    };
    window.debugLogs.push(logEntry);
    console.log(`[${timestamp}] UNHANDLED REJECTION:`, event.reason);
});

// Capture global errors
window.addEventListener('error', event => {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        type: 'globalError',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    };
    window.debugLogs.push(logEntry);
    console.log(`[${timestamp}] GLOBAL ERROR:`, event.message, 'at', event.filename, event.lineno);
});

// Function to display all captured logs
window.showDebugLogs = function() {
    console.log('\n========== CAPTURED LOGS ==========');
    window.debugLogs.forEach(log => {
        console.log(`[${log.timestamp}] [${log.type.toUpperCase()}]`, log.message);
    });
    console.log('===================================\n');
    return window.debugLogs;
};

// Function to copy logs to clipboard
window.copyDebugLogs = function() {
    const logsText = window.debugLogs.map(log =>
        `[${log.timestamp}] [${log.type}] ${log.message}`
    ).join('\n');

    navigator.clipboard.writeText(logsText).then(() => {
        console.log('✅ Logs copied to clipboard!');
    }).catch(err => {
        console.log('❌ Failed to copy logs:', err);
        console.log('Here are the logs:\n', logsText);
    });
};

console.log('✅ Debug logger ready!');
console.log('Commands:');
console.log('  - showDebugLogs()  : Display all captured logs');
console.log('  - copyDebugLogs()  : Copy all logs to clipboard');
console.log('  - debugLogs        : Access raw log array');
