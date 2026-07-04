const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const cloudService = require('../services/cloudService');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-shieldai-key';

// Middleware to protect API routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Example protected route to trigger a cloud scan
router.post('/scan', authenticateToken, async (req, res) => {
  const provider = req.body.provider || 'aws';
  let result;
  
  if (provider === 'aws') {
    result = await cloudService.scanAwsS3();
  } else if (provider === 'gcp') {
    result = await cloudService.scanGcpCompute();
  } else {
    result = { status: 'error', message: 'Unknown provider' };
  }

  // Log scan to DB
  db.run("INSERT INTO AuditLogs (type, title, description, resource, user) VALUES (?, ?, ?, ?, ?)", 
    ['scan', `Full Scan: ${provider}`, `Scan completed with status: ${result.status}`, provider, req.user.username]);

  res.json(result);
});

// Fetch recent audit logs
router.get('/audit-logs', authenticateToken, (req, res) => {
  db.all("SELECT * FROM AuditLogs ORDER BY timestamp DESC LIMIT 20", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'ShieldAI API is running' });
});

// AI Chatbot Backend Logic (Keyword based smart responder)
router.post('/chat', (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const msg = message.toLowerCase();
  let responseText = "I'm not sure about that specific issue. Can you provide more details or ask about IAM, open ports, or Zero Trust?";

  if (msg.includes('port') || msg.includes('open ports')) {
    responseText = "### How to Secure Open Ports\n1. **Identify open ports:** Run `sudo ufw status` or `netstat -tulpn`.\n2. **Close unnecessary ports:** `sudo ufw deny [port]`.\n3. **Use a VPN or Bastion Host:** Restrict access to administrative ports like 22 (SSH) or 3389 (RDP).\n\n*Would you like me to scan your external IP for open ports?*";
  } else if (msg.includes('iam') || msg.includes('identity')) {
    responseText = "### IAM Best Practices\n- **Enforce MFA:** Require Multi-Factor Authentication for all console users.\n- **Least Privilege:** Do not attach full `AdministratorAccess` to standard users or groups.\n- **Rotate Keys:** Ensure Access Keys are rotated every 90 days.\n\nUse our **Compliance Checker** tool to scan your AWS/GCP accounts for IAM violations.";
  } else if (msg.includes('zero trust')) {
    responseText = "### Zero Trust Architecture\nZero Trust assumes that threats exist both inside and outside the network.\n- **Never trust, always verify:** Every access request must be authenticated and authorized.\n- **Microsegmentation:** Divide your network into smaller zones to prevent lateral movement.\n- **Continuous Monitoring:** Analyze logs using our *Threat Map* to detect anomalies.";
  } else if (msg.includes('report') || msg.includes('generate')) {
    responseText = "You can generate a comprehensive security report by clicking the **Download Report** button at the top of the dashboard. This will compile all active detections, compliance scores, and threat maps into a PDF.";
  } else if (msg.includes('sql') || msg.includes('injection')) {
    responseText = "### Preventing SQL Injection\nNever trust user input. Always use **Parameterized Queries** or an ORM.\n\n**Example (Node.js/SQLite):**\n```javascript\n// BAD ❌\ndb.run(`SELECT * FROM users WHERE name = '${userInput}'`);\n\n// GOOD ✅\ndb.run('SELECT * FROM users WHERE name = ?', [userInput]);\n```";
  }

  // Simulate AI processing delay
  setTimeout(() => {
    res.json({ reply: responseText });
  }, 1500);
});

module.exports = router;
