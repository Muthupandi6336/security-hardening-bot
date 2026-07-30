const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 12; // Increased from 10 for stronger hashing

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');

    // Enable WAL mode for better concurrent performance
    db.run("PRAGMA journal_mode=WAL");
    db.run("PRAGMA foreign_keys = ON");

    // Create Users table with additional security fields
    db.run(`CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      force_password_change INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )`, (err) => {
      if (!err) {
        // Seed an admin user if it doesn't exist — with forced password change
        db.get("SELECT * FROM Users WHERE username = ?", ["admin"], (err, row) => {
          if (!row) {
            bcrypt.hash('Admin@123', BCRYPT_ROUNDS, (err, hash) => {
              if (err) return console.error(err);
              db.run(
                "INSERT INTO Users (username, password, role, force_password_change) VALUES (?, ?, ?, ?)",
                ["admin", hash, "admin", 1]
              );
              console.log('Default admin user created: admin / Admin@123 (forced password change on first login)');
            });
          }
        });
      }
    });

    // Create AuditLogs table
    db.run(`CREATE TABLE IF NOT EXISTS AuditLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      title TEXT,
      description TEXT,
      resource TEXT,
      user TEXT,
      ip_address TEXT,
      user_agent TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create Settings table
    db.run(`CREATE TABLE IF NOT EXISTS Settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE,
      value TEXT
    )`);

    // Token Blacklist table — for logout / token revocation
    db.run(`CREATE TABLE IF NOT EXISTS TokenBlacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL,
      user_id INTEGER,
      blacklisted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    )`);

    // Create index on token for fast lookup
    db.run(`CREATE INDEX IF NOT EXISTS idx_token_blacklist ON TokenBlacklist(token)`);

    // Login Attempts table — for account lockout tracking
    db.run(`CREATE TABLE IF NOT EXISTS LoginAttempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      ip_address TEXT,
      success INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create index for fast lockout queries
    db.run(`CREATE INDEX IF NOT EXISTS idx_login_attempts ON LoginAttempts(username, timestamp)`);

    // Refresh Tokens table — track issued refresh tokens
    db.run(`CREATE TABLE IF NOT EXISTS RefreshTokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      revoked INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES Users(id)
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens ON RefreshTokens(token)`);

    // Periodic cleanup: remove expired blacklisted tokens and old login attempts
    setInterval(() => {
      const now = new Date().toISOString();
      db.run("DELETE FROM TokenBlacklist WHERE expires_at < ?", [now]);
      // Clean login attempts older than 24 hours
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      db.run("DELETE FROM LoginAttempts WHERE timestamp < ?", [dayAgo]);
      // Clean revoked refresh tokens
      db.run("DELETE FROM RefreshTokens WHERE revoked = 1 OR expires_at < ?", [now]);
    }, 60 * 60 * 1000); // Run every hour
  }
});

db.BCRYPT_ROUNDS = BCRYPT_ROUNDS;

module.exports = db;
