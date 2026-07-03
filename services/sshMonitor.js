const Tail = require('tail').Tail;
const axios = require('axios');
const fs = require('fs');

const AUTH_LOG_PATH = '/var/log/auth.log';
// We'll keep a simple cache to avoid hitting the IP API too many times for brute force attacks
const ipCache = {};

function startMonitoring(io) {
    if (!fs.existsSync(AUTH_LOG_PATH)) {
        console.warn(`[sshMonitor] ${AUTH_LOG_PATH} not found. Honeypot mode requires auth.log.`);
        return;
    }

    try {
        const tail = new Tail(AUTH_LOG_PATH);
        console.log(`[sshMonitor] Watching ${AUTH_LOG_PATH} for SSH brute force attacks...`);

        tail.on("line", async (data) => {
            // Emit raw log to the terminal UI
            io.emit('raw-log', data);

            // Regex to catch "Failed password for ..." or "Invalid user ... from <IP>"
            const failedRegex = /(?:Failed password for|Invalid user).*? from (\d{1,3}(?:\.\d{1,3}){3}) /;
            const match = data.match(failedRegex);

            if (match) {
                const ip = match[1];
                
                let geo = ipCache[ip];
                if (!geo) {
                    try {
                        const response = await axios.get(`http://ip-api.com/json/${ip}`);
                        if (response.data && response.data.status === 'success') {
                            geo = {
                                lat: response.data.lat,
                                lon: response.data.lon,
                                city: response.data.city || response.data.country
                            };
                            ipCache[ip] = geo;
                        } else {
                            geo = { lat: 0, lon: 0, city: 'Unknown' };
                        }
                    } catch (err) {
                        console.error('[sshMonitor] Geolocation error:', err.message);
                        geo = { lat: 0, lon: 0, city: 'Unknown' };
                    }
                }

                // If we successfully found a location (and it's not literally lat/lon 0,0)
                if (geo.lat !== 0 || geo.lon !== 0) {
                    console.log(`🚨 Attack detected from ${ip} (${geo.city})`);
                    
                    // Emit real threat alert over WebSockets
                    io.emit('threat-alert', {
                        origin: {
                            name: geo.city,
                            lat: geo.lat,
                            lon: geo.lon
                        },
                        target: {
                            name: 'Local Server',
                            lat: 20, // Arbitrary local server location (e.g. India)
                            lon: 77 
                        },
                        severity: 'critical' // SSH brute force is critical
                    });
                }
            }
        });

        tail.on("error", (error) => {
            console.error('[sshMonitor] Tail error:', error);
        });

    } catch (err) {
        console.error('[sshMonitor] Failed to start tailing:', err.message);
    }
}

module.exports = { startMonitoring };
