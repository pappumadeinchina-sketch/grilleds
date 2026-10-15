const db = require('../db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const chatService = require('./chatService');

const JWT_SECRET = process.env.JWT_SECRET || 'pulsechat_super_secret_jwt_key_2026';
const OWNER_EMAIL = '7yf57l@gmail.com';

function generateApiKey() {
  return 'pc_live_' + crypto.randomBytes(24).toString('hex');
}

// Generate letter avatar SVG data URL
function generateLetterAvatar(name) {
  const initial = (name || 'User').trim().charAt(0).toUpperCase() || 'U';
  
  // Pick vibrant WhatsApp-style gradient based on char code
  const colors = [
    ['#10b981', '#047857'], // Emerald
    ['#3b82f6', '#1d4ed8'], // Blue
    ['#8b5cf6', '#6d28d9'], // Purple
    ['#f59e0b', '#b45309'], // Amber
    ['#ec4899', '#be185d'], // Pink
    ['#06b6d4', '#0e7490'], // Cyan
    ['#f97316', '#c2410c']  // Orange
  ];
  const charCode = initial.charCodeAt(0) || 0;
  const [c1, c2] = colors[charCode % colors.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}" />
        <stop offset="100%" stop-color="${c2}" />
      </linearGradient>
    </defs>
    <rect width="128" height="128" rx="64" fill="url(#grad)" />
    <text x="50%" y="54%" font-family="Plus Jakarta Sans, sans-serif" font-size="56" font-weight="bold" fill="#ffffff" dominant-baseline="middle" text-anchor="middle">${initial}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createUser(username, displayName, password, email = '') {
  const existing = db.find('users', u => u.username.toLowerCase() === username.toLowerCase());
  if (existing) {
    throw new Error('Username already taken');
  }
  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);
  const apiKey = generateApiKey();
  const now = Date.now();
  const avatarUrl = generateLetterAvatar(displayName);
  // Local owner check for 7yf57l
  const isOwner = username.toLowerCase() === '7yf57l' || (email && email.toLowerCase() === OWNER_EMAIL.toLowerCase());

  const user = {
    id,
    username: username.toLowerCase(),
    display_name: displayName,
    email: email.toLowerCase(),
    password_hash: passwordHash,
    avatar_url: avatarUrl,
    about: isOwner ? '👑 GrilledS System Owner & Administrator' : 'Hey there! I am using GrilledS.',
    api_key: apiKey,
    role: isOwner ? 'owner' : 'user',
    is_owner: isOwner ? 1 : 0,
    is_banned: 0,
    is_muted: 0,
    online: 0,
    last_seen: now,
    created_at: now
  };

  db.insert('users', user);
  try {
    chatService.addUserToEveryoneGroup(id);
  } catch (err) {
    console.error('Error adding user to Everyone group:', err);
  }
  return getUserById(id);
}

function verifyUser(username, password) {
  const user = db.find('users', u => u.username.toLowerCase() === username.toLowerCase() || (u.email && u.email.toLowerCase() === username.toLowerCase()));
  if (!user) return null;
  if (user.is_banned) {
    throw new Error('This account has been banned by the Administrator.');
  }
  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) return null;
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

function getUserById(id) {
  const user = db.find('users', u => u.id === id);
  if (!user) return null;
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

function getUserByApiKey(apiKey) {
  const user = db.find('users', u => u.api_key === apiKey);
  if (!user) return null;
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

function getUserByUsername(username) {
  const user = db.find('users', u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return null;
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

function listUsers(excludeId = null) {
  return db.get('users')
    .filter(u => !excludeId || u.id !== excludeId)
    .map(u => {
      const { password_hash, ...safe } = u;
      return safe;
    })
    .sort((a, b) => (b.is_owner || 0) - (a.is_owner || 0) || a.display_name.localeCompare(b.display_name));
}

function regenerateApiKey(userId) {
  const newKey = generateApiKey();
  db.update('users', u => u.id === userId, { api_key: newKey });
  return newKey;
}

function updateUserProfile(userId, { displayName, about, avatarUrl }) {
  const updates = {};
  if (displayName) updates.display_name = displayName;
  if (about) updates.about = about;
  if (avatarUrl) updates.avatar_url = avatarUrl;

  db.update('users', u => u.id === userId, updates);
  return getUserById(userId);
}

function setUserPresence(userId, online) {
  db.update('users', u => u.id === userId, { online: online ? 1 : 0, last_seen: Date.now() });
}

// -------------------------------------------------------------
// Admin & Moderation Methods: Owner is 7yf57l
// -------------------------------------------------------------
function isUserAdminOrOwner(userId) {
  const user = db.find('users', u => u.id === userId);
  if (!user) return false;
  if (user.role === 'owner' || user.is_owner === 1) return true;
  if (user.email && user.email.toLowerCase() === OWNER_EMAIL.toLowerCase()) return true;
  if (user.username && user.username.toLowerCase() === '7yf57l') return true;
  return false;
}

function banUser(targetUserId, adminId) {
  if (!isUserAdminOrOwner(adminId)) throw new Error('Unauthorized');
  db.update('users', u => u.id === targetUserId, { is_banned: 1, online: 0 });
  return getUserById(targetUserId);
}

function unbanUser(targetUserId, adminId) {
  if (!isUserAdminOrOwner(adminId)) throw new Error('Unauthorized');
  db.update('users', u => u.id === targetUserId, { is_banned: 0 });
  return getUserById(targetUserId);
}

function toggleMuteUser(targetUserId, adminId) {
  if (!isUserAdminOrOwner(adminId)) throw new Error('Unauthorized');
  const target = db.find('users', u => u.id === targetUserId);
  if (!target) throw new Error('User not found');
  const newMuted = target.is_muted ? 0 : 1;
  db.update('users', u => u.id === targetUserId, { is_muted: newMuted });
  return getUserById(targetUserId);
}

module.exports = {
  JWT_SECRET,
  OWNER_EMAIL,
  generateLetterAvatar,
  createUser,
  verifyUser,
  getUserById,
  getUserByApiKey,
  getUserByUsername,
  listUsers,
  regenerateApiKey,
  updateUserProfile,
  setUserPresence,
  isUserAdminOrOwner,
  banUser,
  unbanUser,
  toggleMuteUser
};
