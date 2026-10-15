require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

// Database initialization
require('./db');
require('./seed');
const chatService = require('./services/chatService');
try {
  chatService.ensureEveryoneGroup();
} catch (e) {
  console.error('Failed to initialize Everyone group:', e);
}

const { router: authRoutes } = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const apiRoutes = require('./routes/apiRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { initSocketHandlers } = require('./services/socketService');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Attach io to express app so routes can broadcast
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// No-cache middleware to prevent browsers from executing stale cached JS/CSS files
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Static files (Frontend UI & Uploads)
app.use(express.static(path.join(__dirname, '../public'), { etag: false, maxAge: 0 }));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads'), { etag: false, maxAge: 0 }));

// Standard API Routes
app.use('/api/auth', authRoutes);
app.use('/api', chatRoutes);
app.use('/api/v1', apiRoutes); // Automation & Smart Glasses API
app.use('/api/admin', adminRoutes); // Admin & Moderation Panel

// Explicit route serving login.html and signup.html
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/signup.html'));
});

app.get('/auth-success', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/auth-success.html'));
});


// Initialize WebSocket Signaling
initSocketHandlers(io);

// Catch-all route to serve SPA frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Render assigns port via process.env.PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🔥 GrilledS Server running on port ${PORT}`);
  console.log(`🌐 Web App: http://localhost:${PORT}`);
  console.log(`🔑 Login Page: http://localhost:${PORT}/login`);
  console.log(`📝 Register Page: http://localhost:${PORT}/signup`);
  console.log(`⚡ Automation API: http://localhost:${PORT}/api/v1`);
  console.log(`👓 Smart Glasses IoT: http://localhost:${PORT}/api/v1/iot/glasses/status`);
  console.log(`===============================================`);
});
