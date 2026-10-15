const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const userService = require('../services/userService');

// Base URL auto-detection (supports Render.com and custom domain)
const baseUrl = (process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

// Passport Google Strategy Setup
const googleClientId = process.env.GOOGLE_CLIENT_ID || '233126200084-5o9aaskbrkh2ldaolfeggpkhidkeb1hn.apps.googleusercontent.com';
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || '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';
const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL || `${baseUrl}/auth/google/callback`;

passport.use(new GoogleStrategy({
  clientID: googleClientId,
  clientSecret: googleClientSecret,
  callbackURL: googleCallbackUrl
}, (accessToken, refreshToken, profile, done) => {
  try {
    const user = userService.findOrCreateGoogleUser(profile);
    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

// Passport GitHub Strategy Setup
const githubClientId = process.env.GITHUB_CLIENT_ID || 'Ov23liSuGosMO8VZipGH';
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET || '610ad62e7927670712ddf9dcee8491a961cf3274';
const githubCallbackUrl = process.env.GITHUB_CALLBACK_URL || `${baseUrl}/auth/github/callback`;

passport.use(new GitHubStrategy({
  clientID: githubClientId,
  clientSecret: githubClientSecret,
  callbackURL: githubCallbackUrl
}, (accessToken, refreshToken, profile, done) => {
  try {
    const user = userService.findOrCreateGithubUser(profile);
    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = userService.getUserById(id);
  done(null, user);
});

// Middleware to authenticate JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, userService.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// ===================== GOOGLE OAUTH ROUTES =====================
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

router.get('/google/callback', passport.authenticate('google', {
  failureRedirect: '/login?error=google_failed',
  session: false
}), (req, res) => {
  const user = req.user;
  const token = jwt.sign({ id: user.id, username: user.username }, userService.JWT_SECRET, { expiresIn: '30d' });
  res.redirect(`/auth-success?token=${encodeURIComponent(token)}`);
});

// ===================== GITHUB OAUTH ROUTES =====================
router.get('/github', passport.authenticate('github', {
  scope: ['user:email']
}));

router.get('/github/callback', passport.authenticate('github', {
  failureRedirect: '/login?error=github_failed',
  session: false
}), (req, res) => {
  const user = req.user;
  const token = jwt.sign({ id: user.id, username: user.username }, userService.JWT_SECRET, { expiresIn: '30d' });
  res.redirect(`/auth-success?token=${encodeURIComponent(token)}`);
});

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const { username, displayName, password } = req.body;
    if (!username || !displayName || !password) {
      return res.status(400).json({ error: 'Username, Display Name, and Password are required' });
    }
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    const user = userService.createUser(cleanUsername, displayName.trim(), password);
    const token = jwt.sign({ id: user.id, username: user.username }, userService.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ user, token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const user = userService.verifyUser(username.trim().toLowerCase(), password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, userService.JWT_SECRET, { expiresIn: '30d' });
    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  const user = userService.getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user });
});

// POST /api/auth/regenerate-api-key
router.post('/regenerate-api-key', authenticateToken, (req, res) => {
  const newKey = userService.regenerateApiKey(req.user.id);
  res.json({ apiKey: newKey });
});

// PUT /api/auth/profile
router.put('/profile', authenticateToken, (req, res) => {
  try {
    const { displayName, about, avatarUrl } = req.body;
    const updated = userService.updateUserProfile(req.user.id, { displayName, about, avatarUrl });
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, authenticateToken };
