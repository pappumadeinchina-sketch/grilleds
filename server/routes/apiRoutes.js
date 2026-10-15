const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const chatService = require('../services/chatService');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

// Middleware to authenticate via Bearer API Key
function authenticateApiKey(req, res, next) {
  const authHeader = req.headers['authorization'];
  let apiKey = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.substring(7).trim();
  } else if (req.headers['x-api-key']) {
    apiKey = req.headers['x-api-key'];
  } else if (req.query.api_key) {
    apiKey = req.query.api_key;
  }

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Missing API key. Provide via Header "Authorization: Bearer <YOUR_API_KEY>" or "x-api-key: <KEY>"'
    });
  }

  const user = userService.getUserByApiKey(apiKey);
  if (!user) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or revoked API key'
    });
  }

  req.apiUser = user;
  next();
}

// 1. Account Info
router.get('/account', authenticateApiKey, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.apiUser.id,
      username: req.apiUser.username,
      displayName: req.apiUser.display_name,
      avatarUrl: req.apiUser.avatar_url,
      about: req.apiUser.about
    }
  });
});

// 2. Automated Messaging: Send Message
router.post('/messages/send', authenticateApiKey, (req, res) => {
  try {
    const { to, conversationId, message, type = 'text', mediaUrl = '', mediaMeta = {} } = req.body;

    if (!message && !mediaUrl) {
      return res.status(400).json({ success: false, error: 'Either "message" or "mediaUrl" must be provided' });
    }

    let targetConvId = conversationId;

    if (!targetConvId) {
      if (!to) {
        return res.status(400).json({ success: false, error: 'Recipient "to" or "conversationId" is required' });
      }

      let targetUser = userService.getUserById(to);
      if (!targetUser) targetUser = userService.getUserByUsername(to);

      if (!targetUser) {
        return res.status(404).json({ success: false, error: `Recipient "${to}" not found` });
      }

      targetConvId = chatService.getOrCreateDirectConversation(req.apiUser.id, targetUser.id);
    }

    const savedMsg = chatService.saveMessage({
      conversationId: targetConvId,
      senderId: req.apiUser.id,
      content: message || '',
      messageType: type,
      mediaUrl,
      mediaMeta
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`conv_${targetConvId}`).emit('new_message', savedMsg);
    }

    res.json({
      success: true,
      data: {
        messageId: savedMsg.id,
        conversationId: targetConvId,
        sender: req.apiUser.username,
        status: savedMsg.status,
        timestamp: savedMsg.created_at
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Automated Messaging: Get Recent Messages
router.get('/messages/recent', authenticateApiKey, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const unreadOnly = req.query.unread === 'true';

    // Get all conversations user belongs to
    const userParts = db.filter('participants', p => p.user_id === req.apiUser.id);
    const convIds = userParts.map(p => p.conversation_id);

    let messages = db.filter('messages', m => 
      convIds.includes(m.conversation_id) && m.sender_id !== req.apiUser.id
    );

    if (unreadOnly) {
      messages = messages.filter(m => m.status !== 'read');
    }

    messages.sort((a, b) => b.created_at - a.created_at);
    const sliced = messages.slice(0, limit);

    res.json({
      success: true,
      count: sliced.length,
      messages: sliced
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Automated Calling
router.post('/calls/initiate', authenticateApiKey, (req, res) => {
  try {
    const { to, type = 'audio' } = req.body;
    if (!to) {
      return res.status(400).json({ success: false, error: 'Recipient "to" required' });
    }

    let targetUser = userService.getUserById(to);
    if (!targetUser) targetUser = userService.getUserByUsername(to);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: `Recipient "${to}" not found` });
    }

    const callId = uuidv4();
    const now = Date.now();

    db.insert('calls', {
      id: callId,
      caller_id: req.apiUser.id,
      receiver_id: targetUser.id,
      call_type: type,
      status: 'initiated',
      started_at: now
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${targetUser.id}`).emit('incoming_call', {
        callId,
        caller: {
          id: req.apiUser.id,
          username: req.apiUser.username,
          displayName: req.apiUser.display_name,
          avatarUrl: req.apiUser.avatar_url
        },
        callType: type,
        timestamp: now
      });
    }

    res.json({
      success: true,
      callId,
      status: 'ringing',
      receiver: targetUser.username,
      callType: type
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Smart Glasses IoT Endpoints
router.get('/iot/glasses/status', authenticateApiKey, (req, res) => {
  try {
    const userParts = db.filter('participants', p => p.user_id === req.apiUser.id);
    const convIds = userParts.map(p => p.conversation_id);

    const unread = db.filter('messages', m => 
      convIds.includes(m.conversation_id) && m.sender_id !== req.apiUser.id && m.status !== 'read'
    ).length;

    const latestCall = db.find('calls', c => 
      c.receiver_id === req.apiUser.id && (c.status === 'initiated' || c.status === 'ringing')
    );

    let callerDetails = null;
    if (latestCall) {
      const caller = userService.getUserById(latestCall.caller_id);
      callerDetails = {
        callId: latestCall.id,
        callerName: caller ? caller.display_name : 'Unknown',
        callerUsername: caller ? caller.username : 'unknown',
        type: latestCall.call_type
      };
    }

    res.json({
      success: true,
      deviceUser: req.apiUser.username,
      unreadCount: unread,
      activeIncomingCall: callerDetails
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/iot/glasses/voice-command', authenticateApiKey, (req, res) => {
  try {
    const { to, transcript, audioUrl } = req.body;
    if (!to) {
      return res.status(400).json({ success: false, error: 'Recipient "to" required' });
    }

    let targetUser = userService.getUserById(to);
    if (!targetUser) targetUser = userService.getUserByUsername(to);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: `Recipient "${to}" not found` });
    }

    const convId = chatService.getOrCreateDirectConversation(req.apiUser.id, targetUser.id);

    const savedMsg = chatService.saveMessage({
      conversationId: convId,
      senderId: req.apiUser.id,
      content: transcript || '',
      messageType: audioUrl ? 'voice' : 'text',
      mediaUrl: audioUrl || '',
      mediaMeta: { source: 'bluetooth_smart_glasses_pi' }
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`conv_${convId}`).emit('new_message', savedMsg);
    }

    res.json({
      success: true,
      message: 'Command executed from Smart Glasses',
      data: savedMsg
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/iot/glasses/quick-call', authenticateApiKey, (req, res) => {
  try {
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ success: false, error: 'Recipient "to" required' });
    }

    let targetUser = userService.getUserById(to);
    if (!targetUser) targetUser = userService.getUserByUsername(to);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: `Recipient "${to}" not found` });
    }

    const callId = uuidv4();
    const now = Date.now();

    db.insert('calls', {
      id: callId,
      caller_id: req.apiUser.id,
      receiver_id: targetUser.id,
      call_type: 'audio',
      status: 'initiated',
      started_at: now
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${targetUser.id}`).emit('incoming_call', {
        callId,
        caller: {
          id: req.apiUser.id,
          username: req.apiUser.username,
          displayName: req.apiUser.display_name,
          avatarUrl: req.apiUser.avatar_url
        },
        callType: 'audio',
        source: 'smart_glasses',
        timestamp: now
      });
    }

    res.json({
      success: true,
      callId,
      status: 'ringing',
      receiver: targetUser.username
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
