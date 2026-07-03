const db = require('../db/database');

const axios = require('axios');

// Simple cache to avoid geolocating the same IP twice
const geoCache = {};
let threatQueue = [];

const init = (io, dbInstance) => {

  // Helper to fetch live IPs
  async function fetchLiveThreats() {
    try {
      const response = await axios.get('https://api.blocklist.de/getlast.php?time=5');
      const ips = response.data.split('\n').filter(ip => ip.trim().length > 0);
      
      // Pick 10 random IPs to queue up
      for(let i = 0; i < 10; i++) {
        const ip = ips[Math.floor(Math.random() * ips.length)];
        if(!ip) continue;
        
        let geo = geoCache[ip];
        if(!geo) {
          try {
            const geoRes = await axios.get(`http://ip-api.com/json/${ip}`);
            if(geoRes.data && geoRes.data.status === 'success') {
              geo = { lat: geoRes.data.lat, lon: geoRes.data.lon, city: geoRes.data.city || geoRes.data.country };
              geoCache[ip] = geo;
            }
          } catch(e) { continue; }
        }
        
        if(geo) {
          threatQueue.push(geo);
          io.emit('raw-log', `[LIVE INTEL] Malicious IP ${ip} detected targeting global infrastructure from ${geo.city} [LAT:${geo.lat}, LON:${geo.lon}]`);
        }
      }
    } catch(e) {
      console.error('Error fetching threats:', e.message);
    }
  }

  // Fetch new threats every 30 seconds
  setInterval(fetchLiveThreats, 30000);
  fetchLiveThreats();

  // Drip feed threats from the queue to the frontend every 2-4 seconds
  setInterval(() => {
    if(threatQueue.length > 0) {
      const geo = threatQueue.shift();
      const severities = ['critical', 'high', 'medium'];
      
      // Target random cloud regions
      const infraTargets = [
        { name: 'US-East', lat: 37.92, lon: -78.02 },
        { name: 'EU-West', lat: 51.5, lon: -0.12 },
        { name: 'AP-South', lat: 19.07, lon: 72.87 },
        { name: 'Tokyo', lat: 35.67, lon: 139.65 }
      ];
      const target = infraTargets[Math.floor(Math.random() * infraTargets.length)];
      
      io.emit('threat-alert', {
        origin: { name: geo.city, lat: geo.lat, lon: geo.lon },
        target: target,
        severity: severities[Math.floor(Math.random() * severities.length)]
      });
    }
  }, 2500);

  io.on('connection', (socket) => {
    console.log('New client connected via WebSocket:', socket.id);

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
