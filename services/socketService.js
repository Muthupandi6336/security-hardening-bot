const db = require('../db/database');
const si = require('systeminformation');

const init = (io, dbInstance) => {
  // Push system stats every 2 seconds to all connected clients
  setInterval(async () => {
    try {
      const cpu = await si.currentLoad();
      const mem = await si.mem();
      io.emit('system-stats', {
        cpu: cpu.currentLoad.toFixed(1),
        ram: ((mem.active / mem.total) * 100).toFixed(1),
        connections: io.engine.clientsCount
      });
    } catch (e) {
      console.error('Stats error:', e);
    }
  }, 2000);

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
