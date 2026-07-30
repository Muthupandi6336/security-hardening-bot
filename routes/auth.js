const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
const {
  sanitizeBody,
  validatePassword,
  checkAccountLock,
  logLoginAttempt,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  authenticateToken
} = require('../middleware/security');

// Brute-force protection: max 5 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter limiter for registration
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many accounts created from this IP, please try again later' }
});

/* ----------------------------------------------------------
   POST /api/auth/register
   Create a new user account with password policy enforcement
---------------------------------------------------------- */
router.post('/register', registerLimiter, sanitizeBody, (req, res) => {
  const { username, password, confirmPassword } = req.body;

  // Validate required fields
  if (!username || !password || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Username validation
  if (username.length < 3 || username.length > 50) {
    return res.status(400).json({ error: 'Username must be 3-50 characters' });
  }

  if (!/^[a-zA-Z0-9_@.\-]+$/.test(username)) {
    return res.status(400).json({ error: 'Username contains invalid characters' });
  }

  // Password match check
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  // Password policy enforcement
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    return res.status(400).json({
      error: 'Password does not meet requirements',
      requirements: passwordCheck.errors
    });
  }

  // Check if user already exists
  db.get("SELECT id FROM Users WHERE username = ?", [username], (err, existing) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Hash password with strong bcrypt rounds
    bcrypt.hash(password, db.BCRYPT_ROUNDS || 12, (err, hash) => {
      if (err) {
        return res.status(500).json({ error: 'Server error during registration' });
      }

      db.run(
        "INSERT INTO Users (username, password, role) VALUES (?, ?, ?)",
        [username, hash, 'user'],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to create account' });
          }

          // Log the registration
          db.run(
            "INSERT INTO AuditLogs (type, title, description, user, ip_address) VALUES (?, ?, ?, ?, ?)",
            ['registration', 'New User Registration', `User ${username} registered`, username, req.ip]
          );

          res.status(201).json({ message: 'Account created successfully. Please login.' });
        }
      );
    });
  });
});

/* ----------------------------------------------------------
   POST /api/auth/login
   Authenticate user, issue access + refresh tokens
---------------------------------------------------------- */
router.post('/login', loginLimiter, sanitizeBody, (req, res) => {
  const { username, password } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Check account lockout first
  checkAccountLock(username, (isLocked) => {
    if (isLocked) {
      return res.status(423).json({
        error: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.',
        code: 'ACCOUNT_LOCKED'
      });
    }

    db.get("SELECT * FROM Users WHERE username = ?", [username], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        logLoginAttempt(username, clientIp, false);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err || !isMatch) {
          logLoginAttempt(username, clientIp, false);
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Successful login
        logLoginAttempt(username, clientIp, true);

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Store refresh token in database
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        db.run(
          "INSERT INTO RefreshTokens (user_id, token, expires_at) VALUES (?, ?, ?)",
          [user.id, refreshToken, expiresAt]
        );

        // Update last login
        db.run("UPDATE Users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);

        // Audit log
        db.run(
          "INSERT INTO AuditLogs (type, title, description, user, ip_address) VALUES (?, ?, ?, ?, ?)",
          ['login', 'User Login', `${username} logged in successfully`, username, clientIp]
        );

        res.json({
          accessToken,
          refreshToken,
          role: user.role || 'user',
          forcePasswordChange: user.force_password_change === 1,
          message: 'Login successful'
        });
      });
    });
  });
});

/* ----------------------------------------------------------
   POST /api/auth/refresh
   Exchange refresh token for a new access token
---------------------------------------------------------- */
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  // Verify refresh token is valid and not revoked
  db.get(
    "SELECT * FROM RefreshTokens WHERE token = ? AND revoked = 0",
    [refreshToken],
    (err, tokenRow) => {
      if (err || !tokenRow) {
        return res.status(401).json({ error: 'Invalid or revoked refresh token' });
      }

      // Verify JWT signature
      const decoded = verifyRefreshToken(refreshToken);
      if (!decoded) {
        // Revoke the invalid token
        db.run("UPDATE RefreshTokens SET revoked = 1 WHERE token = ?", [refreshToken]);
        return res.status(401).json({ error: 'Refresh token expired or invalid' });
      }

      // Get user for new token
      db.get("SELECT * FROM Users WHERE id = ?", [decoded.id], (err, user) => {
        if (err || !user) {
          return res.status(401).json({ error: 'User not found' });
        }

        const newAccessToken = generateAccessToken(user);
        res.json({ accessToken: newAccessToken });
      });
    }
  );
});

/* ----------------------------------------------------------
   POST /api/auth/logout
   Blacklist current tokens and revoke refresh token
---------------------------------------------------------- */
router.post('/logout', authenticateToken, (req, res) => {
  const authHeader = req.headers['authorization'];
  const accessToken = authHeader && authHeader.split(' ')[1];
  const { refreshToken } = req.body;

  // Blacklist the access token
  if (accessToken) {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15min max
    db.run(
      "INSERT INTO TokenBlacklist (token, user_id, expires_at) VALUES (?, ?, ?)",
      [accessToken, req.user.id, expiresAt]
    );
  }

  // Revoke the refresh token
  if (refreshToken) {
    db.run("UPDATE RefreshTokens SET revoked = 1 WHERE token = ?", [refreshToken]);
  }

  // Audit log
  db.run(
    "INSERT INTO AuditLogs (type, title, description, user, ip_address) VALUES (?, ?, ?, ?, ?)",
    ['logout', 'User Logout', `${req.user.username} logged out`, req.user.username, req.ip]
  );

  res.json({ message: 'Logged out successfully' });
});

/* ----------------------------------------------------------
   POST /api/auth/change-password
   Change password (required on first login for default admin)
---------------------------------------------------------- */
router.post('/change-password', authenticateToken, sanitizeBody, (req, res) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ error: 'New passwords do not match' });
  }

  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.valid) {
    return res.status(400).json({
      error: 'New password does not meet requirements',
      requirements: passwordCheck.errors
    });
  }

  db.get("SELECT * FROM Users WHERE id = ?", [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(500).json({ error: 'User not found' });
    }

    bcrypt.compare(currentPassword, user.password, (err, isMatch) => {
      if (err || !isMatch) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      bcrypt.hash(newPassword, db.BCRYPT_ROUNDS || 12, (err, hash) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }

        db.run(
          "UPDATE Users SET password = ?, force_password_change = 0 WHERE id = ?",
          [hash, req.user.id]
        );

        // Audit log
        db.run(
          "INSERT INTO AuditLogs (type, title, description, user, ip_address) VALUES (?, ?, ?, ?, ?)",
          ['security', 'Password Changed', `${req.user.username} changed their password`, req.user.username, req.ip]
        );

        res.json({ message: 'Password changed successfully' });
      });
    });
  });
});

/* ----------------------------------------------------------
   GET /api/auth/me
   Get current authenticated user info
---------------------------------------------------------- */
router.get('/me', authenticateToken, (req, res) => {
  db.get("SELECT id, username, role, created_at, last_login FROM Users WHERE id = ?", [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  });
});

module.exports = router;
