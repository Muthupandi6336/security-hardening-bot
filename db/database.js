const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    // Create Users table
    db.run(`CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )`, (err) => {
      if (!err) {
        // Seed an admin user if it doesn't exist
        db.get("SELECT * FROM Users WHERE username = ?", ["admin"], (err, row) => {
          if (!row) {
            bcrypt.hash('admin123', 10, (err, hash) => {
              if (err) return console.error(err);
              db.run("INSERT INTO Users (username, password) VALUES (?, ?)", ["admin", hash]);
              console.log('Default admin user created: admin / admin123');
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
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create Settings table
    db.run(`CREATE TABLE IF NOT EXISTS Settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE,
      value TEXT
    )`);
  }
});

module.exports = db;
