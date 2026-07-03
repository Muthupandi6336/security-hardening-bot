const db = require('../db/database');

const init = (io, dbInstance) => {
  io.on('connection', (socket) => {
    console.log('New client connected via WebSocket:', socket.id);

    // Real Threat Alerts are now handled by sshMonitor.js 
    // which watches /var/log/auth.log and emits 'threat-alert' events directly via io.emit.

    // Simulate pushing a new notification occasionally
    const notifInterval = setInterval(() => {
      socket.emit('new-notification', {
        type: 'info',
        title: 'Backend Synced',
        message: 'Live connection to Node.js backend is active.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }, 30000);

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      clearInterval(notifInterval);
    });
  });
};

module.exports = { init };
