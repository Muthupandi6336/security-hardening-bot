require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const socketService = require('./services/socketService');
const db = require('./db/database');
const { requestLogger, sanitizeBody } = require('./middleware/security');

const app = express();
const server = http.createServer(app);

/* ----------------------------------------------------------
   CORS CONFIGURATION — Locked down to specific origins
---------------------------------------------------------- */
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  // WebSocket security
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6 // 1MB max message size
});

/* ----------------------------------------------------------
   SECURITY MIDDLEWARE STACK
---------------------------------------------------------- */

// 1. Helmet — Secure HTTP headers with strict CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for inline event handlers
        "https://cdnjs.cloudflare.com",
        "https://cdn.socket.io"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for inline styles
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com"
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "ws://localhost:3000",
        "wss://localhost:3000",
        ...allowedOrigins.map(o => o.replace('http', 'ws'))
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  // Additional security headers
  crossOriginEmbedderPolicy: false, // Allows loading external fonts
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    features: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'none'"],
      payment: ["'none'"]
    }
  }
}));

// 2. CORS with locked-down origins
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 3. Request body parsing with size limits (prevent DoS)
app.use(express.json({ limit: '10kb' })); // 10KB max JSON body
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// 4. Request logging for audit trail
app.use(requestLogger);

// 5. Global input sanitization
app.use(sanitizeBody);

// 6. Static file serving
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
  lastModified: true
}));

/* ----------------------------------------------------------
   ROUTES
---------------------------------------------------------- */
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// Serve login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve main dashboard (SPA fallback)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ----------------------------------------------------------
   GLOBAL ERROR HANDLER — Never leak stack traces
---------------------------------------------------------- */
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { details: err.message })
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

/* ----------------------------------------------------------
   SOCKET.IO INITIALIZATION
---------------------------------------------------------- */
socketService.init(io, db);

/* ----------------------------------------------------------
   SERVER START
---------------------------------------------------------- */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🛡️  ShieldAI Server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   CORS Origins: ${allowedOrigins.join(', ')}`);
  console.log(`   Security: Helmet CSP + Rate Limiting + JWT Auth\n`);
});
