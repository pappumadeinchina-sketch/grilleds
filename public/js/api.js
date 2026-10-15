// GrilledS API Client Service

const API = {
  token: (function() {
    try {
      const t = localStorage.getItem('pc_token');
      return (t && t !== 'null' && t !== 'undefined' && t.trim().length > 10) ? t.trim() : null;
    } catch (e) {
      return null;
    }
  })(),

  setToken(t) {
    if (!t || t === 'null' || t === 'undefined' || typeof t !== 'string' || t.trim().length < 10) {
      this.token = null;
      try { localStorage.removeItem('pc_token'); } catch (e) {}
    } else {
      this.token = t.trim();
      try { localStorage.setItem('pc_token', this.token); } catch (e) {}
    }
  },

  async request(endpoint, options = {}) {
    const headers = options.headers || {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  },

  // Auth Endpoints
  register(username, displayName, password) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, displayName, password })
    });
  },

  login(username, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  getMe() {
    return this.request('/api/auth/me');
  },

  updateProfile({ displayName, about, avatarUrl }) {
    return this.request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ displayName, about, avatarUrl })
    });
  },

  regenerateApiKey() {
    return this.request('/api/auth/regenerate-api-key', { method: 'POST' });
  },

  // Chat & Users
  getUsers() {
    return this.request('/api/users');
  },

  getConversations() {
    return this.request('/api/conversations');
  },

  startDirectConversation(targetUserId) {
    return this.request('/api/conversations/direct', {
      method: 'POST',
      body: JSON.stringify({ targetUserId })
    });
  },

  createGroup(name, participantIds) {
    return this.request('/api/conversations/group', {
      method: 'POST',
      body: JSON.stringify({ name, participantIds })
    });
  },

  getConversation(convId) {
    return this.request(`/api/conversations/${convId}`);
  },

  sendMessage(convId, { content, messageType = 'text', mediaUrl = '', mediaMeta = {}, replyToId = null }) {
    return this.request(`/api/conversations/${convId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, messageType, mediaUrl, mediaMeta, replyToId })
    });
  },

  // Media & File Upload
  uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/api/upload', {
      method: 'POST',
      body: formData
    });
  },

  // Smart Glasses & Automation API Test Helpers
  getGlassesStatus(apiKey) {
    return fetch('/api/v1/iot/glasses/status', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    }).then(r => r.json());
  },

  sendGlassesVoiceCommand(apiKey, to, transcript, audioUrl = null) {
    return fetch('/api/v1/iot/glasses/voice-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ to, transcript, audioUrl })
    }).then(r => r.json());
  },

  triggerQuickCall(apiKey, to) {
    return fetch('/api/v1/iot/glasses/quick-call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ to })
    }).then(r => r.json());
  },

  // Owner / Admin API
  getAdminStats() {
    return this.request('/api/admin/stats');
  },

  broadcastAnnouncement(title, message) {
    return this.request('/api/admin/announce', {
      method: 'POST',
      body: JSON.stringify({ title, message })
    });
  },

  banUser(userId) {
    return this.request('/api/admin/ban', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  },

  unbanUser(userId) {
    return this.request('/api/admin/unban', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  },

  toggleMuteUser(userId) {
    return this.request('/api/admin/toggle-mute', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  },

  kickUser(conversationId, userId) {
    return this.request('/api/admin/kick', {
      method: 'POST',
      body: JSON.stringify({ conversationId, userId })
    });
  },

  adminCreateGroup(name, participantIds) {
    return this.request('/api/admin/create-group', {
      method: 'POST',
      body: JSON.stringify({ name, participantIds })
    });
  },

  getSpectateConversations() {
    return this.request('/api/admin/spectate/conversations');
  },

  getSpectateMessages(conversationId) {
    return this.request(`/api/admin/spectate/conversations/${conversationId}/messages`);
  }
};
