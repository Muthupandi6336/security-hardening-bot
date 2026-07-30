const jwt = require('jsonwebtoken');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-shieldai-key';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'super-secret-refresh-key';

/* ----------------------------------------------------------
   1. INPUT SANITIZATION
   Strips HTML tags and escapes special characters to prevent
   XSS and injection attacks.
---------------------------------------------------------- */
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/* ----------------------------------------------------------
   2. SANITIZE REQUEST BODY MIDDLEWARE
   Recursively sanitizes all string fields in req.body
---------------------------------------------------------- */
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    });
  }
  next();
}

/* ----------------------------------------------------------
   3. JWT AUTHENTICATION MIDDLEWARE
   Verifies access token, checks if blacklisted
---------------------------------------------------------- */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Check if token is blacklisted (logged out)
  db.get("SELECT * FROM TokenBlacklist WHERE token = ?", [token], (err, row) => {
    if (row) {
      return res.status(401).json({ error: 'Token has been revoked. Please login again.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        return res.status(403).json({ error: 'Invalid token' });
      }
      req.user = user;
      next();
    });
  });
}

/* ----------------------------------------------------------
   4. ADMIN-ONLY MIDDLEWARE
---------------------------------------------------------- */
function isAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
}

/* ----------------------------------------------------------
   5. PASSWORD POLICY VALIDATION
   Minimum 8 chars, uppercase, lowercase, number, special char
---------------------------------------------------------- */
function validatePassword(password) {
  const errors = [];
  if (password.length < 8) errors.push('Minimum 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('At least one number');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('At least one special character');
  return { valid: errors.length === 0, errors };
}

/* ----------------------------------------------------------
   6. ACCOUNT LOCKOUT CHECK
   Returns true if account is currently locked
---------------------------------------------------------- */
function checkAccountLock(username, callback) {
  const lockWindow = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;
  const cutoff = new Date(Date.now() - lockWindow).toISOString();

  db.get(
    "SELECT COUNT(*) as attempts FROM LoginAttempts WHERE username = ? AND success = 0 AND timestamp > ?",
    [username, cutoff],
    (err, row) => {
      if (err) return callback(false);
      callback(row && row.attempts >= maxAttempts);
    }
  );
}

/* ----------------------------------------------------------
   7. LOG LOGIN ATTEMPT
---------------------------------------------------------- */
function logLoginAttempt(username, ipAddress, success) {
  db.run(
    "INSERT INTO LoginAttempts (username, ip_address, success) VALUES (?, ?, ?)",
    [username, ipAddress, success ? 1 : 0]
  );
}

/* ----------------------------------------------------------
   8. REQUEST LOGGING MIDDLEWARE
   Logs all API requests to audit trail
---------------------------------------------------------- */
function requestLogger(req, res, next) {
  const start = Date.now();
  const originalEnd = res.end;

  res.end = function(...args) {
    const duration = Date.now() - start;
    const logEntry = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: duration + 'ms',
      ip: req.ip || req.connection.remoteAddress,
      user: req.user ? req.user.username : 'anonymous',
      timestamp: new Date().toISOString()
    };

    // Log security-relevant requests (non-static files)
    if (!req.path.match(/\.(js|css|html|png|svg|json|ico|woff)$/)) {
      console.log(`[AUDIT] ${logEntry.method} ${logEntry.path} ${logEntry.status} ${logEntry.duration} [${logEntry.user}@${logEntry.ip}]`);
    }

    originalEnd.apply(res, args);
  };

  next();
}

/* ----------------------------------------------------------
   9. TOKEN GENERATION HELPERS
---------------------------------------------------------- */
function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role || 'user' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, type: 'refresh' },
    REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, REFRESH_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = {
  sanitizeInput,
  sanitizeBody,
  authenticateToken,
  isAdmin,
  validatePassword,
  checkAccountLock,
  logLoginAttempt,
  requestLogger,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  JWT_SECRET,
  REFRESH_SECRET
};
