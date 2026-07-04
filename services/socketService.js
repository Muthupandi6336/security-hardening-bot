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
      let ips = response.data.split('\n').filter(ip => ip.trim().length > 0);
      
      // Shuffle and pick 10 random IPs
      ips = ips.sort(() => 0.5 - Math.random()).slice(0, 10);
      if(ips.length === 0) return;

      const ipsToFetch = ips.filter(ip => !geoCache[ip]);
      
      if (ipsToFetch.length > 0) {
        try {
          const geoRes = await axios.post('http://ip-api.com/batch', ipsToFetch);
          geoRes.data.forEach(geoInfo => {
            if (geoInfo && geoInfo.status === 'success') {
              geoCache[geoInfo.query] = { 
                lat: geoInfo.lat, 
                lon: geoInfo.lon, 
                city: geoInfo.city || geoInfo.country 
              };
            }
          });
        } catch(e) {
          console.error('IP-API Batch Error:', e.message);
        }
      }

      // Add to queue and broadcast logs
      ips.forEach(ip => {
        const geo = geoCache[ip];
        if (geo) {
          threatQueue.push(geo);
          io.emit('raw-log', `[LIVE INTEL] Malicious IP ${ip} detected targeting global infrastructure from ${geo.city} [LAT:${geo.lat}, LON:${geo.lon}]`);
        }
      });

    } catch(e) {
      console.error('Error fetching threats:', e.message);
    }
  }

  // Fetch new threats every 15 seconds to keep map active
  setInterval(fetchLiveThreats, 15000);
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
