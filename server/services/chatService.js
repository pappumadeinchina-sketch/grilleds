const db = require('../db');
const { v4: uuidv4 } = require('uuid');

function getOrCreateDirectConversation(user1Id, user2Id) {
  // Find conversation where both users are participants and type is direct
  const convs = db.filter('conversations', c => c.type === 'direct');
  for (const c of convs) {
    const p1 = db.find('participants', p => p.conversation_id === c.id && p.user_id === user1Id);
    const p2 = db.find('participants', p => p.conversation_id === c.id && p.user_id === user2Id);
    if (p1 && p2) {
      return c.id;
    }
  }

  // Create new direct conversation
  const convId = uuidv4();
  const now = Date.now();
  
  db.insert('conversations', {
    id: convId,
    type: 'direct',
    name: '',
    avatar_url: '',
    created_by: user1Id,
    created_at: now,
    updated_at: now
  });

  db.insert('participants', {
    conversation_id: convId,
    user_id: user1Id,
    role: 'member',
    joined_at: now
  });

  db.insert('participants', {
    conversation_id: convId,
    user_id: user2Id,
    role: 'member',
    joined_at: now
  });

  return convId;
}

const EVERYONE_GROUP_ID = 'group_everyone';

function ensureEveryoneGroup() {
  let group = db.find('conversations', c => c.id === EVERYONE_GROUP_ID);
  const now = Date.now();
  if (!group) {
    group = {
      id: EVERYONE_GROUP_ID,
      type: 'group',
      name: '🌍 Everyone',
      avatar_url: 'https://api.dicebear.com/7.x/identicon/svg?seed=GrilledSEveryoneCommunity',
      created_by: 'system',
      created_at: now,
      updated_at: now,
      is_everyone_group: 1
    };
    db.insert('conversations', group);
  }

  // Ensure initial welcome message exists in Everyone group
  const existingMsgs = db.filter('messages', m => m.conversation_id === EVERYONE_GROUP_ID);
  if (existingMsgs.length === 0) {
    saveMessage({
      conversationId: EVERYONE_GROUP_ID,
      senderId: 'system',
      content: '🎉 Welcome to GrilledS Everyone Group! All registered users automatically join here to chat and connect.',
      messageType: 'text'
    });
  }

  // Ensure every user in DB is a participant in Everyone group
  const allUsers = db.get('users');
  for (const u of allUsers) {
    const isPart = db.find('participants', p => p.conversation_id === EVERYONE_GROUP_ID && p.user_id === u.id);
    if (!isPart) {
      db.insert('participants', {
        conversation_id: EVERYONE_GROUP_ID,
        user_id: u.id,
        role: (u.role === 'owner' || u.is_owner === 1) ? 'admin' : 'member',
        joined_at: now
      });
    }
  }

  return group;
}

function addUserToEveryoneGroup(userId) {
  ensureEveryoneGroup();
  const existing = db.find('participants', p => p.conversation_id === EVERYONE_GROUP_ID && p.user_id === userId);
  if (!existing) {
    const user = db.find('users', u => u.id === userId);
    db.insert('participants', {
      conversation_id: EVERYONE_GROUP_ID,
      user_id: userId,
      role: (user && (user.role === 'owner' || user.is_owner === 1)) ? 'admin' : 'member',
      joined_at: Date.now()
    });

    if (user) {
      saveMessage({
        conversationId: EVERYONE_GROUP_ID,
        senderId: 'system',
        content: `👋 Welcome @${user.username} to GrilledS!`,
        messageType: 'text'
      });
    }
  }
}

function createGroupConversation(creatorId, name, participantIds, avatarUrl = '') {
  const convId = uuidv4();
  const now = Date.now();
  const finalAvatar = avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`;

  db.insert('conversations', {
    id: convId,
    type: 'group',
    name,
    avatar_url: finalAvatar,
    created_by: creatorId,
    created_at: now,
    updated_at: now
  });

  db.insert('participants', {
    conversation_id: convId,
    user_id: creatorId,
    role: 'admin',
    joined_at: now
  });

  for (const pid of participantIds) {
    if (pid !== creatorId) {
      db.insert('participants', {
        conversation_id: convId,
        user_id: pid,
        role: 'member',
        joined_at: now
      });
    }
  }

  return convId;
}

function getUserConversations(userId) {
  // Ensure Everyone group exists and includes this user
  ensureEveryoneGroup();
  const isPart = db.find('participants', p => p.conversation_id === EVERYONE_GROUP_ID && p.user_id === userId);
  if (!isPart) {
    db.insert('participants', {
      conversation_id: EVERYONE_GROUP_ID,
      user_id: userId,
      role: 'member',
      joined_at: Date.now()
    });
  }

  // Ensure every other registered user in GrilledS has a direct conversation in the list
  const allOtherUsers = db.get('users').filter(u => u.id !== userId);
  for (const other of allOtherUsers) {
    getOrCreateDirectConversation(userId, other.id);
  }

  const userParts = db.filter('participants', p => p.user_id === userId);
  const convIds = userParts.map(p => p.conversation_id);
  const convs = db.filter('conversations', c => convIds.includes(c.id));

  const result = convs.map(conv => {
    // Get last message
    const msgs = db.filter('messages', m => m.conversation_id === conv.id)
                   .sort((a, b) => b.created_at - a.created_at);
    const lastMsg = msgs[0] || null;

    // Unread count
    const unreadCount = db.filter('messages', m => 
      m.conversation_id === conv.id && m.sender_id !== userId && m.status !== 'read'
    ).length;

    if (conv.type === 'direct') {
      const otherPart = db.find('participants', p => p.conversation_id === conv.id && p.user_id !== userId);
      const otherUserRaw = otherPart ? db.find('users', u => u.id === otherPart.user_id) : null;
      let otherUser = null;
      if (otherUserRaw) {
        const { password_hash, ...safe } = otherUserRaw;
        otherUser = safe;
      }

      return {
        ...conv,
        name: otherUser ? otherUser.display_name : 'Direct Chat',
        avatar_url: otherUser ? otherUser.avatar_url : '',
        other_user: otherUser,
        last_message: lastMsg,
        unread_count: unreadCount
      };
    } else {
      const membersCount = db.filter('participants', p => p.conversation_id === conv.id).length;
      return {
        ...conv,
        is_everyone: conv.id === EVERYONE_GROUP_ID,
        members_count: membersCount,
        last_message: lastMsg,
        unread_count: unreadCount
      };
    }
  });

  // Pin Everyone group to the top, active chats next, then all other community members
  return result.sort((a, b) => {
    if (a.id === EVERYONE_GROUP_ID) return -1;
    if (b.id === EVERYONE_GROUP_ID) return 1;

    if (a.last_message && b.last_message) {
      return b.last_message.created_at - a.last_message.created_at;
    }
    if (a.last_message && !b.last_message) return -1;
    if (!a.last_message && b.last_message) return 1;

    const aIsOwner = a.other_user ? (a.other_user.is_owner || 0) : 0;
    const bIsOwner = b.other_user ? (b.other_user.is_owner || 0) : 0;
    if (aIsOwner !== bIsOwner) return bIsOwner - aIsOwner;

    return (a.name || '').localeCompare(b.name || '');
  });
}

function getConversationDetails(convId, userId) {
  const conv = db.find('conversations', c => c.id === convId);
  if (!conv) return null;

  const parts = db.filter('participants', p => p.conversation_id === convId);
  const participants = parts.map(p => {
    const u = db.find('users', user => user.id === p.user_id);
    if (!u) return null;
    const { password_hash, ...safe } = u;
    return { ...safe, role: p.role };
  }).filter(Boolean);

  let otherUser = null;
  if (conv.type === 'direct') {
    otherUser = participants.find(p => p.id !== userId) || participants[0] || null;
  }

  return {
    ...conv,
    name: conv.type === 'direct' && otherUser ? otherUser.display_name : conv.name,
    avatar_url: conv.type === 'direct' && otherUser ? otherUser.avatar_url : conv.avatar_url,
    participants,
    otherUser
  };
}

function saveMessage({ conversationId, senderId, content, messageType = 'text', mediaUrl = '', mediaMeta = {}, replyToId = null }) {
  let sender = null;
  if (senderId !== 'system') {
    sender = db.find('users', u => u.id === senderId);
    if (sender && sender.is_muted) {
      throw new Error('You are muted by the administrator and cannot send messages.');
    }
    if (sender && sender.is_banned) {
      throw new Error('Your account is banned.');
    }
  }

  const id = uuidv4();
  const now = Date.now();

  const message = {
    id,
    conversation_id: conversationId,
    sender_id: senderId,
    sender_username: sender ? sender.username : 'system',
    sender_name: sender ? sender.display_name : 'GrilledS',
    sender_avatar: sender ? sender.avatar_url : 'https://api.dicebear.com/7.x/identicon/svg?seed=GrilledSSystem',
    sender_is_owner: sender ? (sender.is_owner || 0) : 1,
    content: content || '',
    message_type: messageType,
    media_url: mediaUrl || '',
    media_meta: typeof mediaMeta === 'object' ? mediaMeta : {},
    reply_to_id: replyToId,
    reactions: {},
    status: 'sent',
    created_at: now
  };

  db.insert('messages', message);
  db.update('conversations', c => c.id === conversationId, { updated_at: now });

  return message;
}

function getConversationMessages(conversationId, limit = 100) {
  const msgs = db.filter('messages', m => m.conversation_id === conversationId)
                 .sort((a, b) => a.created_at - b.created_at);
  return msgs.slice(-limit).map(m => ({
    ...m,
    reactions: m.reactions || {}
  }));
}

function toggleMessageReaction(messageId, userId, emoji) {
  const msg = db.find('messages', m => m.id === messageId);
  if (!msg) {
    throw new Error('Message not found');
  }

  const reactions = { ...(msg.reactions || {}) };
  let previousEmoji = null;

  // Check if user already reacted with ANY emoji on this message
  for (const [em, userIds] of Object.entries(reactions)) {
    if (Array.isArray(userIds) && userIds.includes(userId)) {
      previousEmoji = em;
      reactions[em] = userIds.filter(id => id !== userId);
      if (reactions[em].length === 0) {
        delete reactions[em];
      }
      break;
    }
  }

  let finalAction = 'added';
  // If user tapped a different emoji, add the new emoji
  if (previousEmoji !== emoji) {
    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }
    reactions[emoji].push(userId);
    finalAction = 'added';
  } else {
    // User tapped the same emoji, so reaction was removed
    finalAction = 'removed';
  }

  db.update('messages', m => m.id === messageId, { reactions });
  return {
    success: true,
    messageId,
    conversationId: msg.conversation_id,
    reactions,
    action: finalAction,
    emoji: finalAction === 'added' ? emoji : null,
    userId
  };
}

function markMessagesAsRead(conversationId, readerId) {
  db.update('messages', 
    m => m.conversation_id === conversationId && m.sender_id !== readerId && m.status !== 'read',
    { status: 'read' }
  );
}

// Admin / Owner Spectator methods
function getAllConversationsForAdmin() {
  const convs = db.get('conversations');
  return convs.map(conv => {
    const parts = db.filter('participants', p => p.conversation_id === conv.id);
    const participantUsers = parts.map(p => {
      const u = db.find('users', user => user.id === p.user_id);
      return u ? { id: u.id, username: u.username, displayName: u.display_name, is_owner: u.is_owner || 0 } : null;
    }).filter(Boolean);

    const msgs = db.filter('messages', m => m.conversation_id === conv.id)
                   .sort((a, b) => b.created_at - a.created_at);

    return {
      id: conv.id,
      type: conv.type,
      name: conv.type === 'group' ? conv.name : (participantUsers.map(u => u.displayName).join(' & ') || 'Direct Chat'),
      participants: participantUsers,
      lastMessage: msgs[0] || null,
      messageCount: msgs.length,
      updated_at: conv.updated_at
    };
  }).sort((a, b) => b.updated_at - a.updated_at);
}

function kickUserFromConversation(conversationId, targetUserId) {
  const parts = db.get('participants');
  const idx = parts.findIndex(p => p.conversation_id === conversationId && p.user_id === targetUserId);
  if (idx !== -1) {
    parts.splice(idx, 1);
    db.save();
    return true;
  }
  return false;
}

module.exports = {
  EVERYONE_GROUP_ID,
  ensureEveryoneGroup,
  addUserToEveryoneGroup,
  getOrCreateDirectConversation,
  createGroupConversation,
  getUserConversations,
  getConversationDetails,
  saveMessage,
  getConversationMessages,
  toggleMessageReaction,
  markMessagesAsRead,
  getAllConversationsForAdmin,
  kickUserFromConversation
};
