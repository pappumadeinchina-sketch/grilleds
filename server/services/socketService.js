const db = require('../db');
const chatService = require('../services/chatService');
const userService = require('../services/userService');

// Active socket mapping: userId -> Set of socketIds
const userSockets = new Map();

function initSocketHandlers(io) {
  io.on('connection', (socket) => {
    let currentUserId = null;

    // User authentication on socket handshake
    socket.on('authenticate', (userData) => {
      if (!userData || !userData.id) return;
      currentUserId = userData.id;

      if (!userSockets.has(currentUserId)) {
        userSockets.set(currentUserId, new Set());
      }
      userSockets.get(currentUserId).add(socket.id);

      socket.join(`user_${currentUserId}`);

      // Set user presence online
      userService.setUserPresence(currentUserId, true);

      io.emit('user_presence_change', { userId: currentUserId, online: 1 });
      console.log(`Socket authenticated: ${userData.username} (${socket.id})`);
    });

    // Join conversation room
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conv_${conversationId}`);
    });

    // Leave conversation room
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conv_${conversationId}`);
    });

    // Send instant message
    socket.on('send_message', (msgData) => {
      try {
        const { conversationId, senderId, content, messageType, mediaUrl, mediaMeta, replyToId } = msgData;
        const message = chatService.saveMessage({
          conversationId,
          senderId,
          content,
          messageType,
          mediaUrl,
          mediaMeta,
          replyToId
        });

        io.to(`conv_${conversationId}`).emit('new_message', message);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // Mark messages read
    socket.on('mark_read', ({ conversationId, userId }) => {
      chatService.markMessagesAsRead(conversationId, userId);
      io.to(`conv_${conversationId}`).emit('messages_read', { conversationId, readerId: userId });
    });

    // Message Reaction Event
    socket.on('react_message', ({ conversationId, messageId, emoji, userId }) => {
      try {
        const uId = userId || currentUserId;
        if (!uId || !messageId || !emoji) return;
        const result = chatService.toggleMessageReaction(messageId, uId, emoji);
        const convId = result.conversationId || conversationId;
        io.to(`conv_${convId}`).emit('message_reaction_updated', result);
        io.to(convId).emit('message_reaction_updated', result);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // Delete Message Event (Delete for me or delete for everyone)
    socket.on('delete_message', ({ conversationId, messageId, deleteFor, userId }) => {
      try {
        const uId = userId || currentUserId;
        if (!uId || !messageId) return;
        const result = chatService.deleteMessage(messageId, uId, deleteFor || 'everyone');
        const convId = result.conversationId || conversationId;
        if (result.deleteFor === 'everyone') {
          io.to(`conv_${convId}`).emit('message_deleted', result);
          io.to(convId).emit('message_deleted', result);
        } else {
          socket.emit('message_deleted', result);
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // WebRTC Calling Signaling Handlers
    socket.on('call_user', ({ callId, caller, receiverId, callType }) => {
      io.to(`user_${receiverId}`).emit('incoming_call', {
        callId,
        caller,
        callType,
        timestamp: Date.now()
      });
    });

    socket.on('call_accept', ({ callId, callerId, receiverId }) => {
      io.to(`user_${callerId}`).emit('call_accepted', { callId, receiverId });
    });

    socket.on('call_reject', ({ callId, callerId, reason }) => {
      io.to(`user_${callerId}`).emit('call_rejected', { callId, reason });
      db.update('calls', c => c.id === callId, { status: 'rejected', ended_at: Date.now() });
    });

    socket.on('call_hangup', ({ callId, targetUserId }) => {
      io.to(`user_${targetUserId}`).emit('call_ended', { callId });
      db.update('calls', c => c.id === callId, { status: 'ended', ended_at: Date.now() });
    });

    // WebRTC ICE Candidates & SDP Offer / Answer
    socket.on('webrtc_offer', ({ targetUserId, offer, callId }) => {
      io.to(`user_${targetUserId}`).emit('webrtc_offer', {
        callerId: currentUserId,
        offer,
        callId
      });
    });

    socket.on('webrtc_answer', ({ targetUserId, answer, callId }) => {
      io.to(`user_${targetUserId}`).emit('webrtc_answer', {
        answer,
        callId
      });
    });

    socket.on('webrtc_ice_candidate', ({ targetUserId, candidate, callId }) => {
      io.to(`user_${targetUserId}`).emit('webrtc_ice_candidate', {
        candidate,
        callId
      });
    });

    // Disconnect cleanup
    socket.on('disconnect', () => {
      if (currentUserId && userSockets.has(currentUserId)) {
        const set = userSockets.get(currentUserId);
        set.delete(socket.id);
        if (set.size === 0) {
          userSockets.delete(currentUserId);
          userService.setUserPresence(currentUserId, false);
          io.emit('user_presence_change', { userId: currentUserId, online: 0, lastSeen: Date.now() });
        }
      }
    });
  });
}

module.exports = { initSocketHandlers };
