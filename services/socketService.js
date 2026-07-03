const db = require('../db/database');

const init = (io, dbInstance) => {
  io.on('connection', (socket) => {
    console.log('New client connected via WebSocket:', socket.id);

    // Simulate sending real-time threat map attacks every 5 seconds
    const threatInterval = setInterval(() => {
      const attackOrigins = [
        { name: 'Moscow', x: 720, y: 120 },
        { name: 'Beijing', x: 940, y: 170 },
        { name: 'Pyongyang', x: 970, y: 195 },
        { name: 'Tehran', x: 740, y: 210 },
        { name: 'São Paulo', x: 350, y: 400 }
      ];
      const infraTargets = [
        { name: 'US-East', x: 280, y: 180 },
        { name: 'EU-West', x: 560, y: 140 },
        { name: 'AP-South', x: 880, y: 280 }
      ];
      const severities = ['critical', 'high', 'medium'];

      const origin = attackOrigins[Math.floor(Math.random() * attackOrigins.length)];
      const target = infraTargets[Math.floor(Math.random() * infraTargets.length)];
      const severity = severities[Math.floor(Math.random() * severities.length)];

      socket.emit('threat-alert', { origin, target, severity });
    }, 5000);

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
      clearInterval(threatInterval);
      clearInterval(notifInterval);
    });
  });
};

module.exports = { init };
