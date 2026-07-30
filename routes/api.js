const express = require('express');
const router = express.Router();
const cloudService = require('../services/cloudService');
const db = require('../db/database');
const { authenticateToken, isAdmin, sanitizeBody } = require('../middleware/security');

/* ----------------------------------------------------------
   POST /api/scan — Trigger a cloud scan (Admin only)
---------------------------------------------------------- */
router.post('/scan', authenticateToken, isAdmin, sanitizeBody, async (req, res) => {
  try {
    const provider = req.body.provider || 'aws';
    
    // Validate provider
    const validProviders = ['aws', 'gcp', 'azure'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider. Use: aws, gcp, or azure' });
    }

    let result;
    if (provider === 'aws') {
      result = await cloudService.scanAwsS3();
    } else if (provider === 'gcp') {
      result = await cloudService.scanGcpCompute();
    } else if (provider === 'azure') {
      result = await cloudService.scanAzureCompute();
    }

    // Log scan to DB with IP and user agent
    db.run(
      "INSERT INTO AuditLogs (type, title, description, resource, user, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        'scan',
        `Full Scan: ${provider.toUpperCase()}`,
        `Scan completed with status: ${result.status}`,
        provider,
        req.user.username,
        req.ip,
        req.get('User-Agent') || 'unknown'
      ]
    );

    res.json(result);
  } catch (error) {
    console.error('Scan error:', error.message);
    res.status(500).json({ error: 'Scan failed. Check server logs.' });
  }
});

/* ----------------------------------------------------------
   POST /api/fix — Trigger automated threat remediation (Admin only)
---------------------------------------------------------- */
router.post('/fix', authenticateToken, isAdmin, sanitizeBody, async (req, res) => {
  try {
    const { action, target, port, ipAddress } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Action type is required (s3_block, ec2_port_revoke, ip_block)' });
    }

    let result;

    if (action === 's3_block') {
      result = await cloudService.fixAwsS3Bucket(target);
    } else if (action === 'ec2_port_revoke') {
      result = await cloudService.fixAwsSecurityGroupPort(target, port || 3306);
    } else if (action === 'ip_block') {
      result = await cloudService.blockIpAddress(ipAddress || target);
    } else {
      return res.status(400).json({ error: 'Unknown remediation action' });
    }

    // Record fix action in AuditLogs
    db.run(
      "INSERT INTO AuditLogs (type, title, description, resource, user, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        'fix',
        `Auto-Fix: ${action.toUpperCase()}`,
        result.message || `Remediation executed for ${target}`,
        target || 'system',
        req.user.username,
        req.ip,
        req.get('User-Agent') || 'unknown'
      ]
    );

    res.json(result);
  } catch (error) {
    console.error('Fix remediation error:', error.message);
    res.status(500).json({ error: 'Remediation failed. Check server logs.' });
  }
});


/* ----------------------------------------------------------
   GET /api/audit-logs — Fetch recent audit logs (Auth required)
---------------------------------------------------------- */
router.get('/audit-logs', authenticateToken, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Cap at 100
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  const type = req.query.type;

  let query = "SELECT * FROM AuditLogs";
  let params = [];

  if (type && ['scan', 'fix', 'alert', 'policy', 'login', 'logout', 'security', 'registration'].includes(type)) {
    query += " WHERE type = ?";
    params.push(type);
  }

  query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch audit logs' });
    res.json(rows);
  });
});

/* ----------------------------------------------------------
   GET /api/health — Public health check
---------------------------------------------------------- */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ShieldAI API',
    uptime: Math.floor(process.uptime()) + 's',
    timestamp: new Date().toISOString()
  });
});

/* ----------------------------------------------------------
   POST /api/chat — AI Security Assistant (Auth required)
---------------------------------------------------------- */
router.post('/chat', authenticateToken, sanitizeBody, (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required and must be a string' });
  }

  if (message.length > 1000) {
    return res.status(400).json({ error: 'Message too long. Maximum 1000 characters.' });
  }

  const msg = message.toLowerCase();
  let responseText = "I'm not sure about that specific issue. Can you provide more details or ask about IAM, open ports, or Zero Trust?";

  // Conversational Manners
  if (/\b(?:hello|hi|hey|greetings)\b/i.test(msg)) {
    responseText = "Hello! 👋 I am the ShieldAI automated security assistant. How can I help you harden your infrastructure today?\n\n*Try asking about IAM, Open Ports, or Compliance Reports.*";
  } else if (/\b(?:thanks|thank you|thx)\b/i.test(msg)) {
    responseText = "You're very welcome! Security is a team effort. Let me know if you need to run another scan or check your policies.";
  }
  // Security Topics
  else if (/\b(?:ports?)\b/i.test(msg)) {
    responseText = "### How to Secure Open Ports\n1. **Identify open ports:** Run `sudo ufw status` or `netstat -tulpn`.\n2. **Close unnecessary ports:** `sudo ufw deny [port]`.\n3. **Use a VPN or Bastion Host:** Restrict access to administrative ports like 22 (SSH) or 3389 (RDP).\n\n*Would you like me to scan your external IP for open ports?*";
  } else if (/\b(?:iam|identity|access)\b/i.test(msg)) {
    responseText = "### IAM Best Practices\n- **Enforce MFA:** Require Multi-Factor Authentication for all console users.\n- **Least Privilege:** Do not attach full `AdministratorAccess` to standard users or groups.\n- **Rotate Keys:** Ensure Access Keys are rotated every 90 days.\n\nUse our **Compliance Checker** tool to scan your AWS/GCP accounts for IAM violations.";
  } else if (/\b(?:zero trust)\b/i.test(msg)) {
    responseText = "### Zero Trust Architecture\nZero Trust assumes that threats exist both inside and outside the network.\n- **Never trust, always verify:** Every access request must be authenticated and authorized.\n- **Microsegmentation:** Divide your network into smaller zones to prevent lateral movement.\n- **Continuous Monitoring:** Analyze logs using our *Threat Map* to detect anomalies.";
  } else if (/\b(?:report|generate)\b/i.test(msg)) {
    responseText = "You can generate a comprehensive security report by clicking the **Download Report** button at the top of the dashboard. This will compile all active detections, compliance scores, and threat maps into a PDF.";
  } else if (/\b(?:sql|injection)\b/i.test(msg)) {
    responseText = "### Preventing SQL Injection\nNever trust user input. Always use **Parameterized Queries** or an ORM.\n\n**Example (Node.js/SQLite):**\n```javascript\n// BAD ❌\ndb.run(`SELECT * FROM users WHERE name = '${userInput}'`);\n\n// GOOD ✅\ndb.run('SELECT * FROM users WHERE name = ?', [userInput]);\n```";
  } else if (/\b(?:xss|cross.?site)\b/i.test(msg)) {
    responseText = "### Preventing XSS (Cross-Site Scripting)\n- **Sanitize all input:** Strip or escape HTML tags from user input.\n- **Use Content Security Policy (CSP):** Set `Content-Security-Policy` headers.\n- **HttpOnly Cookies:** Prevent JavaScript from accessing session cookies.\n- **Output Encoding:** Always encode output when rendering user data in HTML.";
  } else if (/\b(?:password|passwd|credential)\b/i.test(msg)) {
    responseText = "### Password Security Best Practices\n- **Minimum 8 characters** with uppercase, lowercase, number, and special character.\n- **Use bcrypt/scrypt** for hashing (never MD5 or SHA1).\n- **Implement account lockout** after 5 failed attempts.\n- **Enforce password rotation** every 90 days.\n- **Never store passwords in plain text** or in environment variables.";
  }

  // Log chat interaction
  db.run(
    "INSERT INTO AuditLogs (type, title, description, user, ip_address) VALUES (?, ?, ?, ?, ?)",
    ['chat', 'AI Assistant Query', `User asked: ${message.substring(0, 100)}`, req.user.username, req.ip]
  );

  setTimeout(() => {
    res.json({ reply: responseText });
  }, 800);
});

/* ----------------------------------------------------------
   Error handling middleware for this router
---------------------------------------------------------- */
router.use((err, req, res, next) => {
  console.error('[API Error]', err.message);
  res.status(500).json({
    error: 'Internal server error',
    // Only show details in development
    ...(process.env.NODE_ENV !== 'production' && { details: err.message })
  });
});

module.exports = router;
