const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./authRoutes');
const userService = require('../services/userService');
const chatService = require('../services/chatService');
const db = require('../db');

// Middleware to verify Admin/Owner permission
function requireOwnerOrAdmin(req, res, next) {
  if (userService.isUserAdminOrOwner(req.user.id)) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied: Owner privileges required.' });
}

// 1. Get system status & stats for Admin
router.get('/stats', authenticateToken, requireOwnerOrAdmin, (req, res) => {
  const users = db.get('users');
  const conversations = db.get('conversations');
  const messages = db.get('messages');
  const calls = db.get('calls');

  res.json({
    success: true,
    stats: {
      totalUsers: users.length,
      bannedUsers: users.filter(u => u.is_banned).length,
      mutedUsers: users.filter(u => u.is_muted).length,
      totalConversations: conversations.length,
      totalMessages: messages.length,
      totalCalls: calls.length
    }
  });
});

// 2. Announce to all users in all conversations
router.post('/announce', authenticateToken, requireOwnerOrAdmin, (req, res) => {
  try {
    const { title, message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Announcement message is required' });
    }

    const fullAnnouncement = `📢 [OFFICIAL ANNOUNCEMENT FROM OWNER]\n${title ? `*${title}*\n` : ''}${message}`;
    const allConvs = db.get('conversations');
    const io = req.app.get('io');

    for (const conv of allConvs) {
      const savedMsg = chatService.saveMessage({
        conversationId: conv.id,
        senderId: req.user.id,
        content: fullAnnouncement,
        messageType: 'text',
        mediaMeta: { announcement: true, fromOwner: true }
      });

      if (io) {
        io.to(`conv_${conv.id}`).emit('new_message', savedMsg);
      }
    }

    // Also broadcast global notification
    if (io) {
      io.emit('system_announcement', {
        title: title || 'Official Announcement',
        message: message,
        timestamp: Date.now()
      });
    }

    res.json({ success: true, message: `Broadcast sent to ${allConvs.length} conversations.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. User Moderation: Ban user
router.post('/ban', authenticateToken, requireOwnerOrAdmin, (req, res) => {
  try {
    const { userId } = req.body;
    const user = userService.banUser(userId, req.user.id);
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('user_banned', { reason: 'Your account has been banned by the Administrator.' });
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. User Moderation: Unban user
router.post('/unban', authenticateToken, requireOwnerOrAdmin, (req, res) => {
  try {
    const { userId } = req.body;
    const user = userService.unbanUser(userId, req.user.id);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. User Moderation: Mute / Unmute user
router.post('/toggle-mute', authenticateToken, requireOwnerOrAdmin, (req, res) => {
  try {
    const { userId } = req.body;
    const user = userService.toggleMuteUser(userId, req.user.id);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 6. User Moderation: Kick user from conversation
router.post('/kick', authenticateToken, requireOwnerOrAdmin, (req, res) => {
  try {
    const { conversationId, userId } = req.body;
    chatService.kickUserFromConversation(conversationId, userId);
    const io = req.app.get('io');
    if (io) {
      io.to(`conv_${conversationId}`).emit('user_kicked', { conversationId, userId });
    }
    res.json({ success: true, message: 'User removed from conversation.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 7. Admin Create Groups with any members
router.post('/create-group', authenticateToken, requireOwnerOrAdmin, (req, res) => {
  try {
    const { name, participantIds } = req.body;
    if (!name || !participantIds || !Array.isArray(participantIds)) {
      return res.status(400).json({ error: 'name and participantIds are required' });
    }
    const convId = chatService.createGroupConversation(req.user.id, name, participantIds);
    const details = chatService.getConversationDetails(convId, req.user.id);
    res.json({ success: true, conversation: details });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 8. Spectating Chats: Monitor & View all active user conversations & messages
router.get('/spectate/conversations', authenticateToken, requireOwnerOrAdmin, (req, res) => {
  try {
    const conversations = chatService.getAllConversationsForAdmin();
    res.json({ success: true, conversations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/spectate/conversations/:id/messages', authenticateToken, requireOwnerOrAdmin, (req, res) => {
  try {
    const messages = chatService.getConversationMessages(req.params.id, 200);
    const details = chatService.getConversationDetails(req.params.id, req.user.id);
    res.json({ success: true, details, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
