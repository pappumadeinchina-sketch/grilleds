const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('./authRoutes');
const chatService = require('../services/chatService');
const userService = require('../services/userService');

// Multer Storage Configuration
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max file size
});

// GET /api/users - List users directory
router.get('/users', authenticateToken, (req, res) => {
  const users = userService.listUsers(req.user.id);
  res.json({ users });
});

// GET /api/conversations - List active conversations
router.get('/conversations', authenticateToken, (req, res) => {
  const conversations = chatService.getUserConversations(req.user.id);
  res.json({ conversations });
});

// POST /api/conversations/direct - Start or fetch direct conversation
router.post('/conversations/direct', authenticateToken, (req, res) => {
  const { targetUserId } = req.body;
  if (!targetUserId) {
    return res.status(400).json({ error: 'targetUserId is required' });
  }
  const convId = chatService.getOrCreateDirectConversation(req.user.id, targetUserId);
  const details = chatService.getConversationDetails(convId, req.user.id);
  res.json({ conversation: details });
});

// POST /api/conversations/group - Create group conversation
router.post('/conversations/group', authenticateToken, (req, res) => {
  const { name, participantIds } = req.body;
  if (!name || !participantIds || !Array.isArray(participantIds)) {
    return res.status(400).json({ error: 'name and participantIds array are required' });
  }
  const convId = chatService.createGroupConversation(req.user.id, name, participantIds);
  const details = chatService.getConversationDetails(convId, req.user.id);
  res.json({ conversation: details });
});

// GET /api/conversations/:id - Details & messages
router.get('/conversations/:id', authenticateToken, (req, res) => {
  const details = chatService.getConversationDetails(req.params.id, req.user.id);
  if (!details) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  const messages = chatService.getConversationMessages(req.params.id);
  chatService.markMessagesAsRead(req.params.id, req.user.id);
  res.json({ conversation: details, messages });
});

// POST /api/conversations/:id/messages - Send message via REST
router.post('/conversations/:id/messages', authenticateToken, (req, res) => {
  const { content, messageType = 'text', mediaUrl = '', mediaMeta = {}, replyToId = null } = req.body;
  const message = chatService.saveMessage({
    conversationId: req.params.id,
    senderId: req.user.id,
    content,
    messageType,
    mediaUrl,
    mediaMeta,
    replyToId
  });

  // Emit to socket room if socket server attached
  const io = req.app.get('io');
  if (io) {
    io.to(`conv_${req.params.id}`).emit('new_message', message);
  }

  res.status(201).json({ message });
});

// POST /api/upload - Handle file, voice, music, sticker or PDF uploads
router.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  const originalName = req.file.originalname;
  const mimeType = req.file.mimetype;
  const size = req.file.size;

  let inferredType = 'file';
  if (mimeType.startsWith('image/')) inferredType = 'image';
  else if (mimeType.startsWith('video/')) inferredType = 'video';
  else if (mimeType.startsWith('audio/') || req.file.originalname.endsWith('.webm') || req.file.originalname.endsWith('.ogg') || req.file.originalname.endsWith('.mp3')) inferredType = 'audio';
  else if (mimeType === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf')) inferredType = 'pdf';

  res.json({
    url: fileUrl,
    originalName,
    mimeType,
    size,
    inferredType
  });
});

// POST /api/messages/:id/reactions - Toggle reaction on a message
router.post('/messages/:id/reactions', authenticateToken, (req, res) => {
  const { emoji } = req.body;
  if (!emoji) {
    return res.status(400).json({ error: 'Emoji is required' });
  }
  try {
    const result = chatService.toggleMessageReaction(req.params.id, req.user.id, emoji);
    const io = req.app.get('io');
    if (io && result.conversationId) {
      io.to(result.conversationId).emit('message_reaction_updated', result);
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
