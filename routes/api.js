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

module.exports = router;
