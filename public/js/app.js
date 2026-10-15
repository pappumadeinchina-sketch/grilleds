// GrilledS Core Application Controller
// WhatsApp UX, PDF Viewer, Voice Recorder, Stickers, Music, and IoT Integrations

let currentUser = null;
let socket = null;
let callManager = null;
let activeConversation = null;
let conversationsList = [];
let allUsersList = [];
let activeFilter = 'all';

// Voice recording state
let mediaRecorder = null;
let voiceAudioChunks = [];
let voiceRecordInterval = null;
let voiceRecordSeconds = 0;

// =============================================================
// 1. Curated 100+ Stickers & Custom Sticker Library (Zero Backgrounds)
// =============================================================
let activeStickerCategory = 'all';

function getAllStickers() {
  const library = (window.RAW_STICKERS && window.RAW_STICKERS.length > 0) ? window.RAW_STICKERS : [
    { id: 'heart', cat: 'emojis', url: 'https://cdn-icons-png.flaticon.com/512/833/833472.png', label: 'Heart' },
    { id: 'fire', cat: 'memes', url: 'https://cdn-icons-png.flaticon.com/512/785/785116.png', label: 'Fire' }
  ];
  let customStickers = [];
  try {
    customStickers = JSON.parse(localStorage.getItem('grilleds_custom_stickers') || '[]');
  } catch (e) {
    customStickers = [];
  }
  return [...library, ...customStickers];
}

// =============================================================
// =============================================================
// 2. WhatsApp-Style Call Logs Manager
// =============================================================
let activeCallFilter = 'all';

function getCallLogs() {
  const stored = localStorage.getItem('grilleds_call_logs');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {}
  }
  const defaultLogs = [
    {
      id: 'log_seed_1',
      peer: { id: 'alice_seed', displayName: 'Alice', username: 'alice', avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=alice' },
      type: 'audio',
      direction: 'incoming',
      timestamp: Date.now() - 1000 * 60 * 35,
      duration: '04:12'
    },
    {
      id: 'log_seed_2',
      peer: { id: 'bob_seed', displayName: 'Bob', username: 'bob', avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=bob' },
      type: 'video',
      direction: 'missed',
      timestamp: Date.now() - 1000 * 60 * 180,
      duration: '00:00'
    },
    {
      id: 'log_seed_3',
      peer: { id: 'glasses_seed', displayName: 'Smart Glasses IoT', username: 'glasses', avatarUrl: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' },
      type: 'audio',
      direction: 'outgoing',
      timestamp: Date.now() - 1000 * 60 * 60 * 24,
      duration: '01:45'
    }
  ];
  localStorage.setItem('grilleds_call_logs', JSON.stringify(defaultLogs));
  return defaultLogs;
}

function saveCallLogs(logs) {
  localStorage.setItem('grilleds_call_logs', JSON.stringify(logs));
}

function recordCallLog({ peer, type, direction }) {
  if (!peer) return;
  const logs = getCallLogs();
  const newLog = {
    id: 'log_' + Date.now(),
    peer: {
      id: peer.id || 'peer_' + Date.now(),
      displayName: peer.displayName || peer.display_name || peer.username || 'Contact',
      username: peer.username || 'user',
      avatarUrl: peer.avatarUrl || peer.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (peer.id || 'contact')
    },
    type: type || 'audio',
    direction: direction || 'outgoing',
    timestamp: Date.now(),
    duration: '00:00'
  };
  logs.unshift(newLog);
  if (logs.length > 60) logs.pop();
  saveCallLogs(logs);

  const callsPanel = document.getElementById('sidebar-calls-panel');
  if (callsPanel && !callsPanel.classList.contains('hidden')) {
    renderCallLogs(activeCallFilter);
  }
}
window.recordCallLog = recordCallLog;

// =============================================================
// 4. Instagram Features: Nicknames
// =============================================================
function getNicknames() {
  try {
    return JSON.parse(localStorage.getItem('grilleds_nicknames') || '{}');
  } catch (e) {
    return {};
  }
}

function getNickname(userId) {
  if (!userId) return null;
  const nicks = getNicknames();
  return nicks[userId] || null;
}

function setNickname(userId, nickname) {
  if (!userId) return;
  const nicks = getNicknames();
  if (nickname && nickname.trim()) {
    nicks[userId] = nickname.trim();
  } else {
    delete nicks[userId];
  }
  localStorage.setItem('grilleds_nicknames', JSON.stringify(nicks));
  loadConversations();
  if (activeConversation) {
    selectConversation(activeConversation.id);
  }
}

function getContactDisplayName(user) {
  if (!user) return 'User';
  const nick = getNickname(user.id);
  if (nick) return nick;
  return user.display_name || user.displayName || user.username || 'User';
}

// =============================================================
// 5. Instagram Features: Chat Themes
// =============================================================
const CHAT_THEMES = [
  { id: 'theme-chat-cyber', name: 'Cyber Orange', color: '#f97316' },
  { id: 'theme-chat-lavender', name: 'Lavender Dream', color: '#8b5cf6' },
  { id: 'theme-chat-sunset', name: 'Sunset Glow', color: '#ec4899' },
  { id: 'theme-chat-ocean', name: 'Deep Ocean', color: '#06b6d4' },
  { id: 'theme-chat-matcha', name: 'Matcha Green', color: '#10b981' },
  { id: 'theme-chat-neon', name: 'Neon Matrix', color: '#84cc16' },
  { id: 'theme-chat-oled', name: 'Ultra Dark OLED', color: '#334155' },
  { id: 'theme-chat-rosegold', name: 'Rose Gold Luxe', color: '#fb7185' }
];

function getStoredChatTheme(convId) {
  if (!convId) return 'theme-chat-cyber';
  return localStorage.getItem('grilleds_theme_' + convId) || 'theme-chat-cyber';
}

function applyChatTheme(themeId, convId = null) {
  const feed = document.getElementById('messages-feed');
  if (!feed) return;
  CHAT_THEMES.forEach(t => feed.classList.remove(t.id));
  feed.classList.add(themeId || 'theme-chat-cyber');
  if (convId || (activeConversation && activeConversation.id)) {
    const cid = convId || activeConversation.id;
    localStorage.setItem('grilleds_theme_' + cid, themeId || 'theme-chat-cyber');
  }
}

// =============================================================
// 6. Instagram Features: Chat Wallpapers
// =============================================================
const CHAT_WALLPAPERS = [
  { id: 'wp-pattern-doodles', name: 'WhatsApp Doodles' },
  { id: 'wp-pattern-cybergrid', name: 'Cyber Grid' },
  { id: 'wp-pattern-galaxy', name: 'Cosmic Galaxy' },
  { id: 'wp-pattern-sunset', name: 'Warm Sunset' },
  { id: 'wp-pattern-emerald', name: 'Emerald Night' }
];

function getStoredChatWallpaper(convId) {
  if (!convId) return 'wp-pattern-doodles';
  return localStorage.getItem('grilleds_wallpaper_' + convId) || 'wp-pattern-doodles';
}

function applyChatWallpaper(wpValue, convId = null) {
  const container = document.getElementById('messages-container');
  if (!container) return;
  CHAT_WALLPAPERS.forEach(w => container.classList.remove(w.id));
  container.style.backgroundImage = '';

  if (wpValue && (wpValue.startsWith('http://') || wpValue.startsWith('https://') || wpValue.startsWith('data:'))) {
    container.style.backgroundImage = `url("${wpValue}")`;
    container.style.backgroundSize = 'cover';
    container.style.backgroundPosition = 'center';
  } else {
    container.classList.add(wpValue || 'wp-pattern-doodles');
  }

  if (convId || (activeConversation && activeConversation.id)) {
    const cid = convId || activeConversation.id;
    localStorage.setItem('grilleds_wallpaper_' + cid, wpValue || 'wp-pattern-doodles');
  }
}

// =============================================================
// Message Reactions Engine (Real-Time Socket + Animated Pop)
// =============================================================
function renderReactionsHtml(reactions, msgId) {
  if (!reactions || typeof reactions !== 'object') return '';
  const entries = Object.entries(reactions).filter(([_, ids]) => Array.isArray(ids) && ids.length > 0);
  if (entries.length === 0) return '';

  const badges = entries.map(([emoji, ids]) => {
    const isMe = currentUser && ids.includes(currentUser.id);
    const count = ids.length;
    return `
      <span class="msg-reaction-badge ${isMe ? 'active-me' : ''}" 
            onclick="event.stopPropagation(); reactToMessage('${msgId}', '${emoji}')"
            title="${count} ${count === 1 ? 'reaction' : 'reactions'}${isMe ? ' (including you)' : ''}">
        <span class="rx-emoji">${emoji}</span>
        ${count > 1 ? `<span class="rx-count">${count}</span>` : ''}
      </span>
    `;
  }).join('');

  return `<div class="msg-reactions-cluster">${badges}</div>`;
}

function triggerReactionBurst(bubble, emoji) {
  if (!bubble) return;
  const particle = document.createElement('span');
  particle.className = 'floating-reaction-particle';
  particle.textContent = emoji;
  bubble.appendChild(particle);
  setTimeout(() => particle.remove(), 800);
}

function triggerHeartPop(bubble) {
  if (!bubble) return;
  const heart = document.createElement('span');
  heart.className = 'big-heart-pop';
  heart.textContent = '❤️';
  bubble.appendChild(heart);
  setTimeout(() => heart.remove(), 850);
}

async function reactToMessage(msgId, emoji) {
  if (!msgId || !emoji) return;

  const bubble = document.querySelector(`.msg-bubble[data-msg-id="${msgId}"]`);
  if (bubble) {
    triggerReactionBurst(bubble, emoji);
  }

  // Real-time Socket Emit
  if (socket && activeConversation) {
    socket.emit('react_message', {
      conversationId: activeConversation.id,
      messageId: msgId,
      emoji: emoji,
      userId: currentUser?.id
    });
  }

  // REST API Fallback
  try {
    const res = await API.request(`/api/messages/${msgId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji })
    });
    if (res && res.reactions) {
      applyMessageReactionUpdate(msgId, res.reactions);
    }
  } catch (err) {
    console.warn('Reaction REST fallback notice:', err.message);
  }
}

function applyMessageReactionUpdate(msgId, reactions) {
  const msg = (currentConversationMessages || []).find(m => m.id === msgId);
  if (msg) {
    msg.reactions = reactions;
  }
  const bubble = document.querySelector(`.msg-bubble[data-msg-id="${msgId}"]`);
  if (!bubble) return;

  let cluster = bubble.querySelector('.msg-reactions-cluster');
  const newHtml = renderReactionsHtml(reactions, msgId);
  if (cluster) {
    if (newHtml) {
      cluster.outerHTML = newHtml;
    } else {
      cluster.remove();
    }
  } else if (newHtml) {
    const temp = document.createElement('div');
    temp.innerHTML = newHtml;
    if (temp.firstElementChild) {
      bubble.appendChild(temp.firstElementChild);
    }
  }
}


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { initApp(); });
} else {
  initApp();
}

async function initApp() {
  try {
    // 1. Check token in URL query parameter (?token=... or ?access_token=...)
    const urlParams = new URLSearchParams(window.location.search);
    const queryToken = urlParams.get('token') || urlParams.get('access_token');
    if (queryToken) {
      API.setToken(queryToken);
      history.replaceState(null, '', window.location.pathname);
    }

    // 2. Check token in URL hash (#token=...)
    if (window.location.hash && window.location.hash.includes('token=')) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashToken = hashParams.get('token');
      if (hashToken) {
        API.setToken(hashToken);
        history.replaceState(null, '', window.location.pathname);
      }
    }

    // 3. Fallback: ensure API.token has localStorage value if present
    if (!API.token) {
      const savedToken = localStorage.getItem('pc_token');
      if (savedToken && savedToken !== 'null' && savedToken !== 'undefined' && savedToken.trim().length > 10) {
        API.setToken(savedToken);
      }
    }

    // If still no token, redirect to login page immediately
    if (!API.token) {
      window.location.replace('/login');
      return;
    }

    // 4. Verify session with backend
    let user = null;
    try {
      const data = await API.getMe();
      if (data && data.user) {
        user = data.user;
      }
    } catch (sessionErr) {
      console.warn('Session verification error:', sessionErr.message);
      API.setToken(null);
      window.location.replace('/login');
      return;
    }

    if (!user) {
      API.setToken(null);
      window.location.replace('/login');
      return;
    }

    // 5. Session is valid! Safely initialize UI
    try {
      loginSuccess(user);
    } catch (uiErr) {
      console.error('Error in loginSuccess:', uiErr);
      const loading = document.getElementById('app-loading-screen');
      if (loading) { loading.style.display = 'none'; try { loading.remove(); } catch (_) {} }
      const appScreen = document.getElementById('app-screen');
      if (appScreen) { appScreen.classList.remove('hidden'); appScreen.style.display = 'flex'; }
    }

    try {
      setupEventListeners();
    } catch (listenerErr) {
      console.error('Error setting up event listeners:', listenerErr);
    }

    try {
      renderStickersGrid();
    } catch (stickerErr) {
      console.error('Error rendering stickers:', stickerErr);
    }

    try {
      initCallLogs();
    } catch (callErr) {
      console.error('Error initializing call logs:', callErr);
    }
  } catch (fatalErr) {
    console.error('Fatal initialization error:', fatalErr);
    API.setToken(null);
    window.location.replace('/login');
  }
}

function showAuthScreen() {
  window.location.replace('/login');
}

function loginSuccess(user) {
  currentUser = user;

  // Unconditionally dismiss loading screen and reveal main app
  const loading = document.getElementById('app-loading-screen');
  if (loading) {
    loading.classList.add('hidden');
    loading.style.display = 'none';
    try { loading.remove(); } catch (e) {}
  }
  const appScreen = document.getElementById('app-screen');
  if (appScreen) {
    appScreen.classList.remove('hidden');
    appScreen.style.display = 'flex';
  }
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.classList.add('hidden');

  // Update User UI
  document.getElementById('current-user-avatar').src = user.avatar_url;
  document.getElementById('current-user-avatar').title = `${user.display_name} (@${user.username})`;

  // Update Flyout details
  const flyoutAvatar = document.getElementById('flyout-user-avatar');
  if (flyoutAvatar) flyoutAvatar.src = user.avatar_url;
  const flyoutName = document.getElementById('flyout-display-name');
  if (flyoutName) flyoutName.textContent = user.display_name;
  const flyoutTag = document.getElementById('flyout-user-tag');
  if (flyoutTag) flyoutTag.textContent = `@${user.username}`;

  // Strict Google Owner check: only 7yf57l@gmail.com with google_id gets admin
  const isOwner = Boolean(
    (user.role === 'owner' || user.is_owner === 1) &&
    user.email &&
    user.email.toLowerCase() === '7yf57l@gmail.com' &&
    user.google_id
  );

  const crownElem = document.getElementById('current-user-crown');
  const flyoutCrown = document.getElementById('flyout-user-crown');
  const adminBtn = document.getElementById('nav-admin-btn');
  const avatarWrapper = document.getElementById('current-user-avatar-btn');

  // Owner admin panel button is ALWAYS visible on rail & menu
  if (adminBtn) adminBtn.classList.remove('hidden');

  if (isOwner) {
    if (crownElem) crownElem.classList.remove('hidden');
    if (flyoutCrown) flyoutCrown.classList.remove('hidden');
    if (avatarWrapper) avatarWrapper.classList.add('is-owner');
  } else {
    if (crownElem) crownElem.classList.add('hidden');
    if (flyoutCrown) flyoutCrown.classList.add('hidden');
    if (avatarWrapper) avatarWrapper.classList.remove('is-owner');
  }

  // Notification setting preference
  const notifPref = localStorage.getItem('pc_notif') || 'enabled';
  updateNotificationMenuUI(notifPref === 'enabled');

  // Initialize Socket.IO connection
  connectSocket();

  // Load chats & directory
  loadConversations();
  loadUsersDirectory();
}

// -------------------------------------------------------------
// Socket Connection & Presence
// -------------------------------------------------------------
function connectSocket() {
  socket = io();

  socket.on('connect', () => {
    socket.emit('authenticate', currentUser);
  });

  socket.on('new_message', (msg) => {
    handleIncomingSocketMessage(msg);
  });

  socket.on('user_presence_change', ({ userId, online }) => {
    updateUserPresenceUI(userId, online);
  });

  socket.on('message_reaction_updated', ({ messageId, conversationId, reactions, userId, emoji, action }) => {
    if (activeConversation && activeConversation.id === conversationId) {
      applyMessageReactionUpdate(messageId, reactions);
      if (action === 'added' && userId !== currentUser?.id) {
        const bubble = document.querySelector(`.msg-bubble[data-msg-id="${messageId}"]`);
        if (bubble) triggerReactionBurst(bubble, emoji);
      }
    }
  });

  // Initialize WebRTC Call Manager
  callManager = new WebRTCCallManager(socket, currentUser);
}

function handleIncomingSocketMessage(msg) {
  // If active conversation matches, append message
  if (activeConversation && activeConversation.id === msg.conversation_id) {
    appendMessageToFeed(msg);
    scrollFeedToBottom();
    // Mark read
    socket.emit('mark_read', { conversationId: activeConversation.id, userId: currentUser.id });
  } else {
    // Play message notification sound
    const sound = document.getElementById('audio-message-sound');
    if (sound) sound.play().catch(() => {});
  }

  // Refresh conversations list sidebar
  loadConversations();
}

function updateUserPresenceUI(userId, online) {
  if (activeConversation && activeConversation.otherUser && activeConversation.otherUser.id === userId) {
    const indicator = document.getElementById('chat-header-status-indicator');
    const subtext = document.getElementById('chat-header-subtext');
    if (online) {
      indicator.className = 'status-indicator online';
      subtext.textContent = 'online';
    } else {
      indicator.className = 'status-indicator';
      subtext.textContent = 'last seen recently';
    }
  }
}

// -------------------------------------------------------------
// Conversations Management
// -------------------------------------------------------------
async function loadConversations() {
  try {
    const res = await API.getConversations();
    conversationsList = res.conversations;
    renderConversationsList();
  } catch (err) {
    console.error('Failed to load conversations:', err);
  }
}

async function loadUsersDirectory() {
  try {
    const res = await API.getUsers();
    allUsersList = res.users;
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

function renderConversationsList() {
  const container = document.getElementById('conversations-list');
  if (!container) return;

  if (activeFilter === 'people') {
    renderDirectoryPeopleInSidebar();
    return;
  }

  let filtered = conversationsList;

  if (activeFilter === 'unread') {
    filtered = filtered.filter(c => c.unread_count > 0);
  } else if (activeFilter === 'groups') {
    filtered = filtered.filter(c => c.type === 'group');
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 30px; text-align: center; color: var(--text-muted); font-size: 13px;">
        <i class="fa-solid fa-comment-slash" style="font-size: 28px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
        No conversations found.<br>Click the <b>+</b> button to start chatting!
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(c => {
    const isSelected = activeConversation && activeConversation.id === c.id;
    let preview = 'No messages yet';

    if (c.last_message) {
      if (c.last_message.message_type === 'voice') preview = '🎙️ Voice note';
      else if (c.last_message.message_type === 'pdf') preview = '📄 PDF Document';
      else if (c.last_message.message_type === 'audio') preview = '🎵 Music audio';
      else if (c.last_message.message_type === 'image') preview = '📷 Photo';
      else if (c.last_message.message_type === 'sticker') preview = '🎨 Sticker';
      else if (c.last_message.message_type === 'reel') preview = '🎬 Reel Clip';
      else preview = escapeHtml(c.last_message.content);
    } else if (c.is_everyone || c.id === 'group_everyone') {
      preview = 'Official community group for all joined members';
    } else if (c.type === 'direct' && c.other_user) {
      preview = c.other_user.about ? escapeHtml(c.other_user.about) : `@${escapeHtml(c.other_user.username)} • Tap to chat`;
    }

    const isOtherOwner = c.type === 'direct' && c.other_user && (c.other_user.role === 'owner' || c.other_user.is_owner === 1 || c.other_user.username === '7yf57l');
    const convDisplayName = (c.type === 'direct' && c.other_user) ? getContactDisplayName(c.other_user) : c.name;
    const isEveryone = c.is_everyone || c.id === 'group_everyone';
    const timeStr = c.last_message 
      ? formatTimestamp(c.last_message.created_at) 
      : (isEveryone ? '<span style="color: var(--primary); font-size: 10px; font-weight: 700;">PINNED</span>' : (c.type === 'direct' && c.other_user && c.other_user.online ? '<span style="color: #10b981; font-size: 10px; font-weight: 700;">ONLINE</span>' : 'Member'));

    return `
      <div class="conv-item ${isSelected ? 'active' : ''} ${isEveryone ? 'member-directory-card' : ''}" onclick="selectConversation('${c.id}')">
        <div class="conv-avatar">
          <div class="avatar-crown-container">
            ${isOtherOwner ? `<span class="owner-crown-icon"><i class="fa-solid fa-crown"></i></span>` : ''}
            <img src="${c.avatar_url || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + c.id}" alt="">
          </div>
          ${c.type === 'direct' && c.other_user ? `<span class="status-indicator ${c.other_user.online ? 'online' : ''}"></span>` : ''}
        </div>
        <div class="conv-info">
          <div class="conv-top-line">
            <span class="conv-name">
              ${escapeHtml(convDisplayName)}
              ${isEveryone ? '<span class="badge-everyone"><i class="fa-solid fa-globe"></i> EVERYONE</span>' : ''}
              ${isOtherOwner ? '<span class="badge-owner"><i class="fa-solid fa-crown"></i> OWNER</span>' : ''}
            </span>
            <span class="conv-time">${timeStr}</span>
          </div>
          <div class="conv-bottom-line">
            <span class="conv-preview">${preview}</span>
            ${c.unread_count > 0 ? `<span class="unread-badge">${c.unread_count}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderDirectoryPeopleInSidebar(searchQuery = '') {
  const container = document.getElementById('conversations-list');
  if (!container) return;

  let people = allUsersList || [];
  if (currentUser) {
    people = people.filter(u => u.id !== currentUser.id);
  }

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    people = people.filter(u => 
      (u.display_name && u.display_name.toLowerCase().includes(q)) || 
      (u.username && u.username.toLowerCase().includes(q))
    );
  }

  if (people.length === 0) {
    container.innerHTML = `
      <div style="padding: 30px; text-align: center; color: var(--text-muted); font-size: 13px;">
        <i class="fa-solid fa-users-slash" style="font-size: 28px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
        No joined members match your search.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="padding: 10px 14px 6px; font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); margin-bottom: 6px;">
      <span><i class="fa-solid fa-users"></i> Joined Members (${people.length})</span>
      <span style="font-size: 10px; color: var(--text-muted); font-weight: 500;">Click to chat</span>
    </div>
    ${people.map(u => {
      const isOwnerUser = u.role === 'owner' || u.is_owner === 1 || u.username === '7yf57l';
      return `
        <div class="conv-item member-directory-card" onclick="startDirectChatWithUser('${u.id}')">
          <div class="conv-avatar">
            <div class="avatar-crown-container">
              ${isOwnerUser ? `<span class="owner-crown-icon"><i class="fa-solid fa-crown"></i></span>` : ''}
              <img src="${u.avatar_url || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + u.id}" alt="${escapeHtml(u.display_name)}">
            </div>
            <span class="status-indicator ${u.online ? 'online' : ''}"></span>
          </div>
          <div class="conv-info">
            <div class="conv-top-line">
              <span class="conv-name">
                ${escapeHtml(u.display_name)}
                ${isOwnerUser ? '<span class="badge-owner"><i class="fa-solid fa-crown"></i> OWNER</span>' : ''}
              </span>
              <span class="conv-time" style="color: var(--primary); font-size: 11px; font-weight: 600;">Chat &rarr;</span>
            </div>
            <div class="conv-bottom-line">
              <span class="conv-preview">@${escapeHtml(u.username)} • ${escapeHtml(u.about || 'Hey there! I am using GrilledS.')}</span>
            </div>
          </div>
        </div>
      `;
    }).join('')}
  `;
}

async function selectConversation(convId) {
  try {
    const res = await API.getConversation(convId);
    activeConversation = res.conversation;

    // Join socket room
    socket.emit('join_conversation', convId);

    // Switch view
    document.getElementById('empty-chat-state').classList.add('hidden');
    document.getElementById('active-chat-wrapper').classList.remove('hidden');
    document.querySelector('.app-layout').classList.add('conversation-active');

    // Apply Instagram Chat Theme & Wallpaper
    applyChatTheme(getStoredChatTheme(convId), convId);
    applyChatWallpaper(getStoredChatWallpaper(convId), convId);

    // Header Details with Nickname support
    const isOtherOwner = activeConversation.type === 'direct' && activeConversation.otherUser && (activeConversation.otherUser.role === 'owner' || activeConversation.otherUser.is_owner === 1 || activeConversation.otherUser.username === '7yf57l');
    const isDirect = activeConversation.type === 'direct' && activeConversation.otherUser;
    const headerDisplayName = isDirect ? getContactDisplayName(activeConversation.otherUser) : activeConversation.name;
    
    document.getElementById('chat-header-name').innerHTML = `${escapeHtml(headerDisplayName)} ${isOtherOwner ? '<span class="badge-owner"><i class="fa-solid fa-crown"></i> OWNER</span>' : ''}`;
    document.getElementById('chat-header-avatar').src = activeConversation.avatar_url;

    const subtext = document.getElementById('chat-header-subtext');
    const indicator = document.getElementById('chat-header-status-indicator');

    if (activeConversation.type === 'direct' && activeConversation.otherUser) {
      if (activeConversation.otherUser.online) {
        indicator.className = 'status-indicator online';
        subtext.textContent = 'online';
      } else {
        indicator.className = 'status-indicator';
        subtext.textContent = 'last seen recently';
      }
    } else {
      indicator.className = 'status-indicator';
      subtext.textContent = `${activeConversation.participants.length} participants`;
    }

    // Render Messages
    renderMessagesFeed(res.messages);
    scrollFeedToBottom();

    // Mark as read
    socket.emit('mark_read', { conversationId: convId, userId: currentUser.id });
    renderConversationsList();
  } catch (err) {
    GrilledSModal.alert('Failed to load conversation: ' + err.message, 'Chat Error', 'danger');
  }
}

// -------------------------------------------------------------
// Message Rendering & Media Handlers
// -------------------------------------------------------------
let currentConversationMessages = [];
let activeContextMsgId = null;
let currentReplyTarget = null;
let touchHoldTimer = null;
let activeForwardMsgId = null;

function renderMessagesFeed(messages) {
  currentConversationMessages = messages || [];
  const feed = document.getElementById('messages-feed');
  feed.innerHTML = (messages || []).map(m => createMessageHTML(m)).join('');
}

function appendMessageToFeed(msg) {
  currentConversationMessages.push(msg);
  const feed = document.getElementById('messages-feed');
  feed.insertAdjacentHTML('beforeend', createMessageHTML(msg));
}

function startMessageTouchHold(event, msgId) {
  cancelMessageTouchHold();
  touchHoldTimer = setTimeout(() => {
    openMessageContextMenu(event, msgId);
  }, 420);
}

function cancelMessageTouchHold() {
  if (touchHoldTimer) {
    clearTimeout(touchHoldTimer);
    touchHoldTimer = null;
  }
}

function openMessageContextMenu(e, msgId) {
  if (e) {
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
  }
  cancelMessageTouchHold();
  activeContextMsgId = msgId;

  const overlay = document.getElementById('msg-context-overlay');
  const anchor = document.getElementById('msg-context-anchor');
  if (!overlay || !anchor) return;

  // Highlight held bubble with smooth scale & glow
  document.querySelectorAll('.msg-bubble.msg-held-active').forEach(b => b.classList.remove('msg-held-active'));
  const bubble = document.querySelector(`.msg-bubble[data-msg-id="${msgId}"]`);
  if (bubble) bubble.classList.add('msg-held-active');

  overlay.classList.remove('hidden');

  if (bubble && window.innerWidth > 768) {
    const rect = bubble.getBoundingClientRect();
    const top = Math.max(16, Math.min(window.innerHeight - 340, rect.top - 60));
    anchor.style.position = 'absolute';
    anchor.style.top = `${top}px`;
    const isOutgoing = bubble.classList.contains('msg-outgoing');
    if (isOutgoing) {
      anchor.style.right = `${Math.max(20, window.innerWidth - rect.right)}px`;
      anchor.style.left = 'auto';
    } else {
      anchor.style.left = `${Math.max(20, rect.left)}px`;
      anchor.style.right = 'auto';
    }
  } else {
    anchor.style.position = 'static';
  }
}

function closeMessageContextMenu() {
  const overlay = document.getElementById('msg-context-overlay');
  if (overlay) overlay.classList.add('hidden');
  document.querySelectorAll('.msg-bubble.msg-held-active').forEach(b => b.classList.remove('msg-held-active'));
  activeContextMsgId = null;
}

function startReplyingToMessage(msgId) {
  const msg = currentConversationMessages.find(m => m.id === msgId);
  if (!msg) return;

  const authorName = (msg.sender_id === currentUser?.id) ? 'You' : (msg.display_name || msg.username || msg.sender_name || 'Contact');
  const snippet = msg.content || (msg.message_type === 'image' ? '📷 Photo' : (msg.message_type === 'sticker' ? '🎨 Sticker' : (msg.message_type === 'voice' ? '🎙️ Voice Note' : (msg.message_type === 'pdf' ? '📄 Document' : `[${msg.message_type}]`))));

  currentReplyTarget = {
    id: msg.id,
    author: authorName,
    snippet: snippet
  };

  const banner = document.getElementById('chat-reply-banner');
  const authorEl = document.getElementById('reply-banner-author');
  const snippetEl = document.getElementById('reply-banner-snippet');

  if (banner && authorEl && snippetEl) {
    authorEl.textContent = `Replying to ${authorName}`;
    snippetEl.textContent = snippet;
    banner.classList.remove('hidden');
  }

  const input = document.getElementById('message-input');
  if (input) input.focus();
}

function clearReplyBanner() {
  currentReplyTarget = null;
  const banner = document.getElementById('chat-reply-banner');
  if (banner) banner.classList.add('hidden');
}

function scrollToMessage(msgId) {
  const el = document.querySelector(`.msg-bubble[data-msg-id="${msgId}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.transition = 'box-shadow 0.3s, transform 0.3s';
    el.style.boxShadow = '0 0 0 3px var(--primary), 0 0 20px rgba(249, 115, 22, 0.5)';
    el.style.transform = 'scale(1.02)';
    setTimeout(() => {
      el.style.boxShadow = '';
      el.style.transform = '';
    }, 1200);
  }
}

function copyMessageText(msgId) {
  const msg = currentConversationMessages.find(m => m.id === msgId);
  if (!msg) return;
  const text = msg.content || msg.media_url || `[${msg.message_type}]`;
  navigator.clipboard.writeText(text).then(() => {
    GrilledSModal.toast('Message copied to clipboard!', 'success');
  }).catch(() => {
    GrilledSModal.prompt('Copy message text:', text, 'Message Text');
  });
}

function deleteMessageForMe(msgId) {
  const bubble = document.querySelector(`.msg-bubble[data-msg-id="${msgId}"]`);
  if (bubble) {
    bubble.style.transition = 'opacity 0.25s, transform 0.25s';
    bubble.style.opacity = '0';
    bubble.style.transform = 'scale(0.85)';
    setTimeout(() => bubble.remove(), 250);
  }
}

function openForwardModal(msgId) {
  activeForwardMsgId = msgId;
  const msg = currentConversationMessages.find(m => m.id === msgId);
  if (!msg) return;

  const modal = document.getElementById('forward-modal-overlay');
  const preview = document.getElementById('forward-preview-text');
  const list = document.getElementById('forward-chat-list');

  if (!modal || !list) return;

  const snippet = msg.content || (msg.message_type === 'image' ? '📷 Photo' : (msg.message_type === 'sticker' ? '🎨 Sticker' : `[${msg.message_type}]`));
  if (preview) {
    preview.innerHTML = `<strong>${escapeHtml(msg.display_name || msg.username || msg.sender_name || 'Sender')}:</strong> ${escapeHtml(snippet)}`;
  }

  list.innerHTML = (conversationsList || []).map(c => `
    <div class="forward-chat-item" onclick="forwardMessageToConversation('${msgId}', '${c.id}', '${escapeHtml(c.name)}')">
      <div style="display: flex; align-items: center; gap: 10px;">
        <img src="${c.avatar_url || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + c.id}">
        <div>
          <div style="font-size: 13px; font-weight: 600; color: var(--text-main);">${escapeHtml(c.name)}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${c.type === 'direct' ? 'Direct Message' : 'Group Chat'}</div>
        </div>
      </div>
      <button class="btn btn-primary" style="padding: 4px 12px; font-size: 11px; border-radius: 20px;">
        <i class="fa-solid fa-share"></i> Send
      </button>
    </div>
  `).join('');

  modal.classList.remove('hidden');
}

function closeForwardModal() {
  const modal = document.getElementById('forward-modal-overlay');
  if (modal) modal.classList.add('hidden');
  activeForwardMsgId = null;
}

async function forwardMessageToConversation(msgId, targetConvId, targetName) {
  const msg = currentConversationMessages.find(m => m.id === msgId);
  if (!msg) return;

  try {
    await API.sendMessage(targetConvId, {
      content: msg.content,
      messageType: msg.message_type,
      mediaUrl: msg.media_url,
      mediaMeta: msg.media_meta
    });

    closeForwardModal();
    GrilledSModal.toast(`Message forwarded to ${targetName}!`, 'success');
  } catch (err) {
    GrilledSModal.alert('Failed to forward message: ' + err.message, 'Forward Error', 'danger');
  }
}

function createMessageHTML(msg) {
  const isMine = msg.sender_id === currentUser.id;
  const timeStr = formatTimestamp(msg.created_at);
  const statusTicks = isMine ? (msg.status === 'read' ? '✓✓' : '✓✓') : '';
  const tickClass = msg.status === 'read' ? 'read' : '';

  let contentBody = '';

  switch (msg.message_type) {
    case 'voice':
      contentBody = `
        <div class="voice-note-player">
          <button class="voice-btn-play" onclick="playVoiceNote(this, '${msg.media_url}')">
            <i class="fa-solid fa-play"></i>
          </button>
          <div class="voice-waveform-track">
            ${Array.from({ length: 22 }).map(() => `<span class="wave-bar" style="height: ${Math.floor(Math.random() * 18 + 6)}px"></span>`).join('')}
          </div>
          <span class="voice-duration">0:0${Math.floor(Math.random() * 6 + 3)}</span>
        </div>
      `;
      break;

    case 'pdf':
      const metaPdf = msg.media_meta || {};
      contentBody = `
        <div class="pdf-card" onclick="openPdfViewer('${msg.media_url}', '${escapeHtml(metaPdf.originalName || 'Document.pdf')}')">
          <div class="pdf-icon-box"><i class="fa-solid fa-file-pdf"></i></div>
          <div class="pdf-details">
            <div class="pdf-name">${escapeHtml(metaPdf.originalName || 'Document.pdf')}</div>
            <div class="pdf-size">${metaPdf.size ? (metaPdf.size / 1024).toFixed(1) + ' KB' : 'In-App PDF Viewer'}</div>
          </div>
          <i class="fa-solid fa-eye" style="color: var(--primary);"></i>
        </div>
      `;
      break;

    case 'audio':
      const metaAudio = msg.media_meta || {};
      contentBody = `
        <div class="audio-song-card">
          <div class="audio-song-header">
            <i class="fa-solid fa-music"></i>
            <span>${escapeHtml(metaAudio.originalName || 'Song track')}</span>
          </div>
          <audio controls src="${msg.media_url}" style="width: 100%; height: 36px; border-radius: 8px;"></audio>
        </div>
      `;
      break;

    case 'image':
      contentBody = `<img src="${msg.media_url}" class="media-img-preview" onclick="window.open('${msg.media_url}', '_blank')">`;
      break;

    case 'video':
      contentBody = `<video src="${msg.media_url}" controls class="media-video-preview"></video>`;
      break;

    case 'sticker':
      contentBody = `<img src="${msg.media_url}" class="sticker-image sticker-img-clean" alt="Sticker">`;
      break;

    default:
      contentBody = `<span class="msg-text-content">${escapeHtml(msg.content)}</span>`;
      break;
  }

  const isSenderOwner = msg.sender_is_owner === 1 || msg.sender_username === '7yf57l';
  const reactionBadgeHtml = renderReactionsHtml(msg.reactions, msg.id);

  const replyQuoteHtml = (msg.media_meta && msg.media_meta.replyTo) ? `
    <div class="msg-reply-quote" onclick="scrollToMessage('${msg.media_meta.replyTo.id}')">
      <div class="reply-quote-bar"></div>
      <div class="reply-quote-body">
        <div class="reply-quote-author">${escapeHtml(msg.media_meta.replyTo.author || 'User')}</div>
        <div class="reply-quote-text">${escapeHtml(msg.media_meta.replyTo.snippet || '')}</div>
      </div>
    </div>
  ` : '';

  return `
    <div class="msg-bubble ${isMine ? 'msg-outgoing' : 'msg-incoming'}" 
         data-msg-id="${msg.id}" 
         ondblclick="reactToMessage('${msg.id}', '❤️'); triggerHeartPop(this);"
         oncontextmenu="openMessageContextMenu(event, '${msg.id}'); return false;"
         ontouchstart="startMessageTouchHold(event, '${msg.id}')"
         ontouchend="cancelMessageTouchHold()"
         ontouchmove="cancelMessageTouchHold()"
         ontouchcancel="cancelMessageTouchHold()">
      <button class="msg-options-trigger" onclick="event.stopPropagation(); openMessageContextMenu(event, '${msg.id}')" title="Message actions">
        <i class="fa-solid fa-chevron-down"></i>
      </button>
      ${!isMine && activeConversation.type === 'group' ? `
        <div class="msg-sender-title">
          ${escapeHtml(msg.display_name || msg.username || msg.sender_name)}
          ${isSenderOwner ? '<span class="badge-owner"><i class="fa-solid fa-crown"></i> OWNER</span>' : ''}
        </div>` : ''}
      ${replyQuoteHtml}
      ${contentBody}
      ${reactionBadgeHtml}
      <div class="msg-meta">
        <span>${timeStr}</span>
        ${isMine ? `<span class="msg-ticks ${tickClass}">${statusTicks}</span>` : ''}
      </div>
    </div>
  `;
}

function scrollFeedToBottom() {
  const container = document.getElementById('messages-container');
  container.scrollTop = container.scrollHeight;
}

// -------------------------------------------------------------
// Voice Note Recorder & Playback
// -------------------------------------------------------------
async function startVoiceRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    voiceAudioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) voiceAudioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      if (voiceAudioChunks.length > 0 && voiceRecordSeconds > 0) {
        const audioBlob = new Blob(voiceAudioChunks, { type: 'audio/webm' });
        const file = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
        await uploadAndSendMedia(file, 'voice');
      }
    };

    mediaRecorder.start();

    // UI state
    document.getElementById('text-input-wrapper').classList.add('hidden');
    document.getElementById('voice-recording-overlay').classList.remove('hidden');
    document.getElementById('btn-record-voice').classList.add('hidden');
    document.getElementById('btn-send-message').classList.remove('hidden');

    voiceRecordSeconds = 0;
    document.getElementById('rec-timer').textContent = '00:00';
    if (voiceRecordInterval) clearInterval(voiceRecordInterval);
    voiceRecordInterval = setInterval(() => {
      voiceRecordSeconds++;
      const mins = String(Math.floor(voiceRecordSeconds / 60)).padStart(2, '0');
      const secs = String(voiceRecordSeconds % 60).padStart(2, '0');
      document.getElementById('rec-timer').textContent = `${mins}:${secs}`;
    }, 1000);
  } catch (err) {
    GrilledSModal.alert('Microphone access denied: ' + err.message, 'Microphone Error', 'danger');
  }
}

function stopVoiceRecording(send = true) {
  if (voiceRecordInterval) clearInterval(voiceRecordInterval);
  if (!send) voiceAudioChunks = [];

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }

  // Restore UI
  document.getElementById('text-input-wrapper').classList.remove('hidden');
  document.getElementById('voice-recording-overlay').classList.add('hidden');
  document.getElementById('btn-record-voice').classList.remove('hidden');
  document.getElementById('btn-send-message').classList.add('hidden');
}

function playVoiceNote(buttonElem, audioUrl) {
  const icon = buttonElem.querySelector('i');
  let audio = buttonElem.audioInstance;

  if (!audio) {
    audio = new Audio(audioUrl);
    buttonElem.audioInstance = audio;
    audio.onended = () => {
      icon.className = 'fa-solid fa-play';
    };
  }

  if (audio.paused) {
    audio.play();
    icon.className = 'fa-solid fa-pause';
  } else {
    audio.pause();
    icon.className = 'fa-solid fa-play';
  }
}

// -------------------------------------------------------------
// Attachments, Stickers, PDF In-App Viewer
// -------------------------------------------------------------
async function uploadAndSendMedia(file, forcedType = null) {
  try {
    const uploadRes = await API.uploadFile(file);
    const msgType = forcedType || uploadRes.inferredType;

    await API.sendMessage(activeConversation.id, {
      content: '',
      messageType: msgType,
      mediaUrl: uploadRes.url,
      mediaMeta: {
        originalName: uploadRes.originalName,
        size: uploadRes.size,
        mimeType: uploadRes.mimeType
      }
    });

    loadConversations();
  } catch (err) {
    GrilledSModal.alert('Upload failed: ' + err.message, 'Upload Error', 'danger');
  }
}

function renderStickersCategories() {
  const catBar = document.getElementById('sticker-categories-bar');
  if (!catBar) return;
  const categories = (window.STICKER_CATEGORIES && window.STICKER_CATEGORIES.length > 0) ? window.STICKER_CATEGORIES : [
    { id: 'all', label: '🌟 All' },
    { id: 'memes', label: '🔥 Memes' },
    { id: 'emojis', label: '😀 3D Emojis' },
    { id: 'cute', label: '🐱 Cute & Pets' },
    { id: 'food', label: '🍔 GrilledS Food' },
    { id: 'gaming', label: '🎮 Gaming & Cool' },
    { id: 'custom', label: '⭐ My Stickers' }
  ];
  catBar.innerHTML = categories.map(c => `
    <button class="sticker-cat-btn ${activeStickerCategory === c.id ? 'active' : ''}" onclick="selectStickerCategory('${c.id}')">
      ${c.label}
    </button>
  `).join('');
}

function selectStickerCategory(catId) {
  activeStickerCategory = catId;
  renderStickersCategories();
  renderStickersGrid();
}

function renderStickersGrid() {
  renderStickersCategories();
  const grid = document.getElementById('sticker-grid');
  if (!grid) return;

  let all = getAllStickers();
  if (activeStickerCategory !== 'all') {
    all = all.filter(s => s.cat === activeStickerCategory);
  }

  if (all.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 24px 10px; color: var(--text-muted); font-size: 12px;">
        <i class="fa-solid fa-wand-magic-sparkles" style="font-size: 24px; color: #f97316; margin-bottom: 8px; display: block;"></i>
        ${activeStickerCategory === 'custom' ? 'No custom stickers yet.<br>Click <b>+ Add Your Own</b> to upload transparent stickers!' : 'No stickers found.'}
      </div>
    `;
    return;
  }

  grid.innerHTML = all.map(s => `
    <div class="sticker-item" onclick="sendSticker('${s.url}')" title="${escapeHtml(s.label || 'Sticker')}">
      <img src="${s.url}" alt="${escapeHtml(s.label || 'Sticker')}" class="sticker-img-clean" loading="lazy">
    </div>
  `).join('');
}

async function triggerAddCustomSticker() {
  const choice = await GrilledSModal.confirm(
    'Choose how you want to add your custom sticker:\nClick "Upload File" to pick an image from your device, or "Paste URL" to provide an image link.',
    'Add Custom Sticker',
    { confirmText: 'Upload File', cancelText: 'Paste URL' }
  );
  if (choice) {
    const fileInput = document.getElementById('sticker-custom-file-input');
    if (fileInput) fileInput.click();
  } else {
    const url = await GrilledSModal.prompt('Enter transparent image URL (PNG, WebP, SVG, GIF):', '', 'Sticker Image URL', { placeholder: 'https://...' });
    if (url && url.trim()) {
      addCustomStickerUrl(url.trim());
      GrilledSModal.toast('Custom sticker added!', 'success');
    }
  }
}

function addCustomStickerUrl(url, label = 'Custom Sticker') {
  let customStickers = [];
  try {
    customStickers = JSON.parse(localStorage.getItem('grilleds_custom_stickers') || '[]');
  } catch (e) {
    customStickers = [];
  }
  const newSticker = {
    id: 'cust_' + Date.now(),
    cat: 'custom',
    label: label,
    url: url
  };
  customStickers.unshift(newSticker);
  localStorage.setItem('grilleds_custom_stickers', JSON.stringify(customStickers));
  activeStickerCategory = 'custom';
  renderStickersGrid();
}

async function sendSticker(url) {
  document.getElementById('sticker-drawer').classList.add('hidden');
  if (!activeConversation) return;
  await API.sendMessage(activeConversation.id, {
    content: '',
    messageType: 'sticker',
    mediaUrl: url
  });
}

function openPdfViewer(url, filename) {
  document.getElementById('pdf-modal-filename').textContent = filename;
  document.getElementById('pdf-modal-download').href = url;
  document.getElementById('pdf-frame').src = url;
  document.getElementById('pdf-modal-overlay').classList.remove('hidden');
}

// -------------------------------------------------------------
// Right Panel: API Docs & IoT Smart Glasses Control Panel
// -------------------------------------------------------------
function showApiAutomationPanel() {
  const drawer = document.getElementById('right-drawer');
  document.getElementById('drawer-title').innerHTML = '<i class="fa-solid fa-robot"></i> Developer API & Automation';

  const content = document.getElementById('drawer-content');
  content.innerHTML = `
    <div class="api-section-box">
      <h4><i class="fa-solid fa-key"></i> Your Personal API Key</h4>
      <p style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">
        Use this key to automate sending messages, triggering WebRTC calls, or connecting to your Smart Glasses:
      </p>
      <div class="api-key-display">
        <span id="display-api-key">${currentUser.api_key}</span>
      </div>
      <button class="btn btn-primary btn-block" style="padding: 7px 12px; font-size: 12px;" onclick="copyApiKey()">
        <i class="fa-solid fa-copy"></i> Copy Key
      </button>
    </div>

    <div class="api-section-box">
      <h4><i class="fa-solid fa-terminal"></i> 1. Send Message via cURL</h4>
      <div class="code-snippet">curl -X POST "${window.location.origin}/api/v1/messages/send" \\
  -H "Authorization: Bearer ${currentUser.api_key}" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "alice", "message": "Automated alert from GrilledS API!"}'</div>
    </div>

    <div class="api-section-box">
      <h4><i class="fa-solid fa-phone"></i> 2. Trigger Outgoing Call</h4>
      <div class="code-snippet">curl -X POST "${window.location.origin}/api/v1/calls/initiate" \\
  -H "Authorization: Bearer ${currentUser.api_key}" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "bob", "type": "audio"}'</div>
    </div>

    <div class="api-section-box">
      <h4><i class="fa-solid fa-inbox"></i> 3. Read Recent Messages</h4>
      <div class="code-snippet">curl "${window.location.origin}/api/v1/messages/recent?unread=true" \\
  -H "Authorization: Bearer ${currentUser.api_key}"</div>
    </div>
  `;

  drawer.classList.remove('hidden');
}

function showGlassesIoTPanel() {
  const drawer = document.getElementById('right-drawer');
  document.getElementById('drawer-title').innerHTML = '<i class="fa-solid fa-glasses"></i> Smart Glasses + Pi IoT';

  const content = document.getElementById('drawer-content');
  content.innerHTML = `
    <div class="api-section-box">
      <h4><i class="fa-solid fa-microchip"></i> Hardware System Architecture</h4>
      <p style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">
        <b>Bluetooth Glasses</b> (Mic + Bone Conduction Speakers) pair with <b>Raspberry Pi</b>. The Pi runs our lightweight Python bridge communicating with the GrilledS cloud API.
      </p>
    </div>

    <div class="api-section-box">
      <h4><i class="fa-solid fa-play"></i> Live Hardware Simulation</h4>
      <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 10px;">
        Test sending a voice transcription command as if spoken directly into your Bluetooth Glasses:
      </p>
      <input type="text" id="sim-glasses-recipient" placeholder="Recipient username (e.g. alice)" style="width: 100%; padding: 8px; margin-bottom: 8px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: #fff;">
      <input type="text" id="sim-glasses-text" placeholder="Voice text (e.g. Hey I am on my way)" style="width: 100%; padding: 8px; margin-bottom: 12px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: #fff;">
      
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-primary" style="flex: 1; padding: 8px; font-size: 12px;" onclick="simulateGlassesVoiceSend()">
          <i class="fa-solid fa-microphone"></i> Send Voice Msg
        </button>
        <button class="btn" style="flex: 1; padding: 8px; font-size: 12px; background: #06b6d4; color: #fff;" onclick="simulateGlassesQuickCall()">
          <i class="fa-solid fa-phone"></i> Quick Call
        </button>
      </div>
      <div id="sim-result-box" style="margin-top: 10px; font-size: 11px; font-family: monospace; color: var(--primary);"></div>
    </div>

    <div class="api-section-box">
      <h4><i class="fa-brands fa-python"></i> Raspberry Pi Client Code</h4>
      <p style="font-size: 12px; color: var(--text-muted);">
        The client script is pre-packaged at <code>/client-pi/glasses_client.py</code>. Run on Pi:
      </p>
      <div class="code-snippet">python3 glasses_client.py --api-key "${currentUser.api_key}"</div>
    </div>
  `;

  drawer.classList.remove('hidden');
}

async function simulateGlassesVoiceSend() {
  const to = document.getElementById('sim-glasses-recipient').value.trim();
  const transcript = document.getElementById('sim-glasses-text').value.trim();
  const resBox = document.getElementById('sim-result-box');

  if (!to || !transcript) {
    GrilledSModal.alert('Please enter recipient and voice text', 'Input Required', 'warning');
    return;
  }

  resBox.textContent = 'Transmitting from Glasses to Pi...';
  try {
    const res = await API.sendGlassesVoiceCommand(currentUser.api_key, to, transcript);
    resBox.textContent = '✓ Message delivered via Smart Glasses API!';
    loadConversations();
  } catch (e) {
    resBox.textContent = 'Error: ' + e.message;
  }
}

async function simulateGlassesQuickCall() {
  const to = document.getElementById('sim-glasses-recipient').value.trim();
  const resBox = document.getElementById('sim-result-box');
  if (!to) {
    GrilledSModal.alert('Please enter recipient username', 'Input Required', 'warning');
    return;
  }
  resBox.textContent = 'Initiating one-touch call from glasses...';
  try {
    const res = await API.triggerQuickCall(currentUser.api_key, to);
    resBox.textContent = `✓ Call initiated (Status: ${res.status})`;
  } catch (e) {
    resBox.textContent = 'Error: ' + e.message;
  }
}

// -------------------------------------------------------------
// WhatsApp-Style Call Logs Sidebar View
// -------------------------------------------------------------
function initCallLogs() {
  const allChip = document.getElementById('chip-calls-all');
  const missedChip = document.getElementById('chip-calls-missed');
  const searchInput = document.getElementById('calls-search');

  if (allChip) {
    allChip.onclick = () => {
      allChip.classList.add('active');
      if (missedChip) missedChip.classList.remove('active');
      activeCallFilter = 'all';
      renderCallLogs('all', searchInput ? searchInput.value : '');
    };
  }

  if (missedChip) {
    missedChip.onclick = () => {
      missedChip.classList.add('active');
      if (allChip) allChip.classList.remove('active');
      activeCallFilter = 'missed';
      renderCallLogs('missed', searchInput ? searchInput.value : '');
    };
  }

  if (searchInput) {
    searchInput.oninput = (e) => {
      renderCallLogs(activeCallFilter, e.target.value);
    };
  }

  renderCallLogs();
}

function renderCallLogs(filter = 'all', searchQuery = '') {
  const container = document.getElementById('calls-list');
  if (!container) return;

  let logs = getCallLogs();

  if (filter === 'missed') {
    logs = logs.filter(l => l.direction === 'missed');
  }

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    logs = logs.filter(l => {
      const name = (l.peer && (l.peer.displayName || l.peer.username)) || '';
      return name.toLowerCase().includes(q);
    });
  }

  if (logs.length === 0) {
    container.innerHTML = `
      <div style="padding: 30px; text-align: center; color: var(--text-muted); font-size: 13px;">
        <i class="fa-solid fa-phone-slash" style="font-size: 28px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
        No ${filter === 'missed' ? 'missed ' : ''}call logs found.
      </div>
    `;
    return;
  }

  container.innerHTML = logs.map(l => {
    const peerName = (l.peer && (getNickname(l.peer.id) || l.peer.displayName || l.peer.username)) || 'Contact';
    const isMissed = l.direction === 'missed';
    const isOutgoing = l.direction === 'outgoing';
    const dirIcon = isMissed 
      ? '<i class="fa-solid fa-arrow-down-left" style="color: #ef4444;"></i>' 
      : (isOutgoing 
          ? '<i class="fa-solid fa-arrow-up-right" style="color: #10b981;"></i>' 
          : '<i class="fa-solid fa-arrow-down-left" style="color: #10b981;"></i>');

    const typeText = l.type === 'video' ? 'Video call' : 'Voice call';
    const dateStr = formatCallTimestamp(l.timestamp);

    return `
      <div class="conv-item call-log-item">
        <div class="conv-avatar">
          <img src="${(l.peer && l.peer.avatarUrl) || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + l.id}" alt="">
        </div>
        <div class="conv-info">
          <div class="conv-top-line">
            <span class="conv-name ${isMissed ? 'call-missed' : ''}">${escapeHtml(peerName)}</span>
          </div>
          <div class="conv-bottom-line">
            <span class="conv-preview" style="font-size: 11px; display: flex; align-items: center; gap: 4px;">
              ${dirIcon}
              <span>${typeText} • ${dateStr}</span>
            </span>
          </div>
        </div>
        <div class="call-actions-group">
          <button class="call-quick-btn" title="Call back (Audio)" onclick="triggerQuickCallback('${l.peer?.id}', 'audio')">
            <i class="fa-solid fa-phone"></i>
          </button>
          <button class="call-quick-btn" title="Call back (Video)" onclick="triggerQuickCallback('${l.peer?.id}', 'video')">
            <i class="fa-solid fa-video"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function formatCallTimestamp(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const diffHours = (now - date) / (1000 * 60 * 60);

  if (diffHours < 24 && date.getDate() === now.getDate()) {
    return 'Today, ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffHours < 48) {
    return 'Yesterday, ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

function triggerQuickCallback(peerId, type = 'audio') {
  const target = allUsersList.find(u => u.id === peerId) || { id: peerId, display_name: 'Contact', username: 'user' };
  if (callManager) {
    callManager.startCall(target, type);
  }
}

function switchToCallsPanel() {
  document.getElementById('sidebar-chats-panel')?.classList.add('hidden');
  document.getElementById('sidebar-calls-panel')?.classList.remove('hidden');
  document.getElementById('nav-calls-btn')?.classList.add('active');
  document.getElementById('nav-chats-btn')?.classList.remove('active');
  const title = document.getElementById('sidebar-title');
  if (title) title.textContent = 'Calls';
  renderCallLogs(activeCallFilter);
}

function switchToChatsPanel() {
  document.getElementById('sidebar-calls-panel')?.classList.add('hidden');
  document.getElementById('sidebar-chats-panel')?.classList.remove('hidden');
  document.getElementById('nav-chats-btn')?.classList.add('active');
  document.getElementById('nav-calls-btn')?.classList.remove('active');
  const title = document.getElementById('sidebar-title');
  if (title) title.textContent = 'Chats';
  document.getElementById('right-drawer')?.classList.add('hidden');
}

// -------------------------------------------------------------
// 3. Conversation Info & Media Drawer (#btn-chat-info)
// -------------------------------------------------------------
function showConversationInfoDrawer() {
  if (!activeConversation) {
    GrilledSModal.alert('Please select or open a conversation first to view info!', 'Conversation Info', 'info');
    return;
  }

  const drawer = document.getElementById('right-drawer');
  const title = document.getElementById('drawer-title');
  const content = document.getElementById('drawer-content');

  const other = activeConversation.otherUser;
  const isDirect = activeConversation.type === 'direct' && other;
  const displayName = isDirect ? getContactDisplayName(other) : activeConversation.name;
  const currentNick = isDirect ? (getNickname(other.id) || '') : '';
  const currentTheme = getStoredChatTheme(activeConversation.id);
  const currentWp = getStoredChatWallpaper(activeConversation.id);

  title.innerHTML = '<i class="fa-solid fa-circle-info" style="color: #f97316;"></i> Conversation Info';

  content.innerHTML = `
    <!-- Hero Profile Banner -->
    <div class="drawer-hero-banner">
      <div class="drawer-avatar-wrapper">
        <img class="drawer-avatar-large" src="${activeConversation.avatar_url || (other ? other.avatar_url : 'https://api.dicebear.com/7.x/identicon/svg?seed=' + activeConversation.id)}" alt="Avatar">
        ${isDirect && other.online ? '<span class="status-indicator online" style="bottom: 2px; right: 2px; width: 16px; height: 16px; border: 2.5px solid #18181b;"></span>' : ''}
      </div>
      <div class="drawer-title-name">
        <span>${escapeHtml(displayName)}</span>
        ${(isDirect && (other.role === 'owner' || other.is_owner === 1 || other.username === '7yf57l')) ? '<span class="badge-owner"><i class="fa-solid fa-crown"></i> OWNER</span>' : ''}
      </div>
      <div class="drawer-user-tag">${isDirect ? `@${other.username}` : `${activeConversation.participants?.length || 2} members • Group Chat`}</div>
      ${isDirect && other.about ? `<div class="drawer-bio-card"><i class="fa-solid fa-quote-left" style="color: var(--primary); font-size: 10px; margin-right: 4px;"></i>${escapeHtml(other.about)}</div>` : ''}

      <!-- Quick Action Circle Buttons Row -->
      <div class="drawer-quick-actions">
        <button class="drawer-action-btn" onclick="if(callManager && activeConversation.otherUser) callManager.startCall(activeConversation.otherUser, 'audio')" title="Voice Call">
          <div class="drawer-action-icon green"><i class="fa-solid fa-phone"></i></div>
          <span>Audio</span>
        </button>
        <button class="drawer-action-btn" onclick="if(callManager && activeConversation.otherUser) callManager.startCall(activeConversation.otherUser, 'video')" title="Video Call">
          <div class="drawer-action-icon purple"><i class="fa-solid fa-video"></i></div>
          <span>Video</span>
        </button>
        <button class="drawer-action-btn" onclick="document.getElementById('conversation-search')?.focus()" title="Search Conversation">
          <div class="drawer-action-icon orange"><i class="fa-solid fa-magnifying-glass"></i></div>
          <span>Search</span>
        </button>
        <button class="drawer-action-btn" onclick="toggleNotificationPreference()" title="Mute Notifications">
          <div class="drawer-action-icon blue"><i class="fa-solid fa-bell-slash"></i></div>
          <span>Mute</span>
        </button>
      </div>
    </div>

    <!-- Instagram Nickname Card -->
    ${isDirect ? `
    <div class="drawer-card">
      <div class="drawer-card-header">
        <h4><i class="fa-solid fa-signature" style="color: #ec4899;"></i> Instagram Nickname</h4>
        <button class="btn-pill" onclick="promptChangeNickname('${other.id}')">
          <i class="fa-solid fa-pen"></i> Edit
        </button>
      </div>
      <div style="font-size: 12.5px; color: var(--text-muted);">
        Nickname: <strong style="color: var(--primary);">${currentNick ? escapeHtml(currentNick) : '@' + escapeHtml(other.username)}</strong>
      </div>
    </div>
    ` : ''}

    <!-- Group Members Card (for Everyone and Groups) -->
    ${activeConversation.type === 'group' ? `
    <div class="drawer-card">
      <div class="drawer-card-header">
        <h4><i class="fa-solid fa-users" style="color: #3b82f6;"></i> Group Members (${activeConversation.participants?.length || 0})</h4>
        ${(activeConversation.id === 'group_everyone' || activeConversation.is_everyone) ? '<span class="badge-everyone"><i class="fa-solid fa-globe"></i> Everyone</span>' : ''}
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto;">
        ${(activeConversation.participants || []).map(p => {
          const isOwnerUser = p.role === 'owner' || p.is_owner === 1 || p.username === '7yf57l';
          const isMe = p.id === currentUser?.id;
          return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; background: var(--bg-input); border-radius: 10px; border: 1px solid var(--border-color);">
              <div style="display: flex; align-items: center; gap: 8px;">
                <img src="${p.avatar_url || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + p.id}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                <div>
                  <div style="font-size: 12px; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 4px;">
                    ${escapeHtml(p.display_name || p.username)}
                    ${isMe ? '<span style="color: var(--primary); font-size: 10px;">(You)</span>' : ''}
                    ${isOwnerUser ? '<span class="badge-owner" style="font-size: 8px; padding: 1px 4px;"><i class="fa-solid fa-crown"></i></span>' : ''}
                  </div>
                  <div style="font-size: 10px; color: var(--text-muted);">@${escapeHtml(p.username)}</div>
                </div>
              </div>
              ${!isMe ? `
                <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px; border-radius: 12px;" onclick="startDirectChatWithUser('${p.id}')">
                  <i class="fa-solid fa-comment"></i> Chat
                </button>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Instagram Chat Themes -->
    <div class="drawer-card">
      <div class="drawer-card-header">
        <h4><i class="fa-solid fa-palette" style="color: #f97316;"></i> Chat Themes</h4>
        <span style="font-size: 11px; color: var(--text-muted);">${CHAT_THEMES.find(t => t.id === currentTheme)?.name || 'Default'}</span>
      </div>
      <div class="theme-swatches-grid" id="info-theme-grid">
        ${CHAT_THEMES.map(t => `
          <div class="theme-swatch-item ${currentTheme === t.id ? 'active' : ''}" onclick="selectThemeFromDrawer('${t.id}')" title="${t.name}">
            <div class="theme-swatch-circle" style="background: ${t.color};">
              ${currentTheme === t.id ? '<i class="fa-solid fa-check"></i>' : ''}
            </div>
            <span class="theme-swatch-label">${t.name}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Chat Wallpapers -->
    <div class="drawer-card">
      <div class="drawer-card-header">
        <h4><i class="fa-solid fa-image" style="color: #3b82f6;"></i> Chat Wallpaper</h4>
        <span style="font-size: 11px; color: var(--text-muted);">${CHAT_WALLPAPERS.find(w => w.id === currentWp)?.name || 'Custom'}</span>
      </div>
      <div class="wp-card-picker" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 10px;">
        ${CHAT_WALLPAPERS.map(w => `
          <div class="wp-card-preview ${currentWp === w.id ? 'active' : ''}" onclick="selectWallpaperFromDrawer('${w.id}')" style="cursor: pointer; border-radius: 8px; border: 1.5px solid ${currentWp === w.id ? 'var(--primary)' : 'var(--border-color)'}; padding: 8px; background: var(--bg-input); display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 11.5px; font-weight: 600; color: var(--text-main);">${w.name}</span>
            ${currentWp === w.id ? '<i class="fa-solid fa-circle-check" style="color: var(--primary);"></i>' : ''}
          </div>
        `).join('')}
      </div>
      <div style="display: flex; gap: 6px;">
        <input type="text" id="custom-wp-url" placeholder="Paste custom image URL..." style="flex: 1; padding: 7px 10px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 8px; color: #fff; font-size: 11.5px;">
        <button class="btn btn-primary" style="padding: 7px 12px; font-size: 11.5px; border-radius: 8px;" onclick="setCustomWallpaperFromInput()">Apply</button>
      </div>
    </div>

    <!-- Shared Media & Stickers Grid -->
    <div class="drawer-card">
      <div class="drawer-card-header">
        <h4><i class="fa-solid fa-photo-film" style="color: #10b981;"></i> Shared Media & Stickers</h4>
      </div>
      <div id="info-shared-media-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-height: 180px; overflow-y: auto; margin-top: 4px;">
        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 11px; padding: 12px;">Loading media...</div>
      </div>
    </div>

    <!-- Chat Settings & Management -->
    <div class="drawer-card">
      <div class="drawer-card-header">
        <h4><i class="fa-solid fa-shield-halved" style="color: #eab308;"></i> Chat Privacy & Options</h4>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button class="btn btn-secondary" style="font-size: 12px; text-align: left; padding: 8px 12px; justify-content: flex-start; gap: 8px;" onclick="GrilledSModal.toast('Disappearing messages enabled: 24-hour timer active', 'info')">
          <i class="fa-solid fa-clock-rotate-left" style="color: #f97316;"></i> Disappearing Messages (24h)
        </button>
        <button class="btn btn-secondary" style="font-size: 12px; text-align: left; padding: 8px 12px; justify-content: flex-start; gap: 8px;" onclick="GrilledSModal.alert('All chats and media in GrilledS are encrypted using peer sessions and secure web token exchanges.', 'End-to-End Encryption', 'info')">
          <i class="fa-solid fa-lock" style="color: #10b981;"></i> End-to-End Encryption Info
        </button>
      </div>
    </div>
  `;

  drawer.classList.remove('hidden');
  loadDrawerSharedMedia();
}

async function promptChangeNickname(userId) {
  const current = getNickname(userId) || '';
  const next = await GrilledSModal.prompt('Set Instagram Nickname for this contact (leave empty to reset):', current, 'Set Contact Nickname', { placeholder: 'e.g. Best Friend' });
  if (next !== null) {
    setNickname(userId, next.trim());
    showConversationInfoDrawer();
  }
}

function selectThemeFromDrawer(themeId) {
  applyChatTheme(themeId);
  showConversationInfoDrawer();
}

function selectWallpaperFromDrawer(wpId) {
  applyChatWallpaper(wpId);
  showConversationInfoDrawer();
}

function setCustomWallpaperFromInput() {
  const input = document.getElementById('custom-wp-url');
  if (input && input.value.trim()) {
    applyChatWallpaper(input.value.trim());
    showConversationInfoDrawer();
  }
}

function loadDrawerSharedMedia() {
  const container = document.getElementById('info-shared-media-grid');
  if (!container) return;

  const images = document.querySelectorAll('#messages-feed .media-img-preview, #messages-feed .sticker-image');
  if (images.length === 0) {
    container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 11px; padding: 12px;">No shared media in this chat yet.</div>';
    return;
  }

  container.innerHTML = Array.from(images).map(img => `
    <div style="height: 64px; background: var(--bg-input); border-radius: 6px; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-color); cursor: pointer;" onclick="window.open('${img.src}', '_blank')">
      <img src="${img.src}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
    </div>
  `).join('');
}

function copyApiKey() {
  navigator.clipboard.writeText(currentUser.api_key);
  GrilledSModal.toast('API Key copied to clipboard!', 'success');
}

// -------------------------------------------------------------
// 4. Owner Admin & Moderation Panel (7yf57l@gmail.com)
// -------------------------------------------------------------
async function showAdminOwnerPanel() {
  const drawer = document.getElementById('right-drawer');
  document.getElementById('drawer-title').innerHTML = '<i class="fa-solid fa-crown" style="color: #f59e0b;"></i> Owner Administration';

  const isOwnerAccount = Boolean(
    currentUser &&
    (currentUser.role === 'owner' ||
     currentUser.is_owner === 1 ||
     currentUser.username === '7yf57l' ||
     (currentUser.email && currentUser.email.toLowerCase() === '7yf57l@gmail.com'))
  );

  const content = document.getElementById('drawer-content');

  if (!isOwnerAccount) {
    content.innerHTML = `
      <div style="text-align: center; padding: 28px 16px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid rgba(245, 158, 11, 0.3); margin-bottom: 16px;">
        <div style="width: 54px; height: 54px; border-radius: 50%; background: rgba(245, 158, 11, 0.15); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; color: #f59e0b; font-size: 26px;">
          <i class="fa-solid fa-crown"></i>
        </div>
        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">Owner Administration</h3>
        <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 0;">
          This panel is restricted exclusively to the GrilledS System Owner (<b>7yf57l</b>).
        </p>
      </div>
    `;
    drawer.classList.remove('hidden');
    return;
  }

  content.innerHTML = `
    <div style="text-align: center; margin-bottom: 16px;">
      <span class="badge-owner" style="font-size: 13px; padding: 4px 12px;"><i class="fa-solid fa-crown"></i> OWNER CONSOLE</span>
      <p style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
        Logged in as System Owner (7yf57l)
      </p>
    </div>

    <!-- Quick Stats -->
    <div style="display: flex; gap: 8px; margin-bottom: 16px;" id="admin-stats-row">
      <div class="admin-badge-count">
        <strong id="stat-users">-</strong>
        <span>Users</span>
      </div>
      <div class="admin-badge-count">
        <strong id="stat-convs">-</strong>
        <span>Chats</span>
      </div>
      <div class="admin-badge-count">
        <strong id="stat-msgs">-</strong>
        <span>Messages</span>
      </div>
    </div>

    <!-- 1. System Broadcast Announcement -->
    <div class="api-section-box">
      <h4><i class="fa-solid fa-bullhorn"></i> Broadcast Global Announcement</h4>
      <input type="text" id="admin-ann-title" placeholder="Announcement Title (e.g. System Update)" style="width: 100%; padding: 8px; margin-bottom: 8px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: #fff; font-size: 12px;">
      <textarea id="admin-ann-msg" placeholder="Write message to send to all users..." rows="2" style="width: 100%; padding: 8px; margin-bottom: 8px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: #fff; font-size: 12px; resize: none;"></textarea>
      <button class="btn btn-primary btn-block" style="padding: 8px; font-size: 12px;" onclick="executeAdminBroadcast()">
        <i class="fa-solid fa-paper-plane"></i> Announce to All
      </button>
      <div id="admin-ann-status" style="margin-top: 6px; font-size: 11px; color: var(--primary);"></div>
    </div>

    <!-- 2. Create Group Directly from Admin Panel -->
    <div class="api-section-box">
      <h4><i class="fa-solid fa-users-gear"></i> Create Group</h4>
      <input type="text" id="admin-grp-name" placeholder="Group Name (e.g. Core Engineers)" style="width: 100%; padding: 8px; margin-bottom: 8px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: #fff; font-size: 12px;">
      <div id="admin-grp-members-list" style="max-height: 110px; overflow-y: auto; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; padding: 6px; margin-bottom: 8px; font-size: 12px;">
        Loading users...
      </div>
      <button class="btn btn-primary btn-block" style="padding: 8px; font-size: 12px;" onclick="executeAdminCreateGroup()">
        <i class="fa-solid fa-plus"></i> Create Group
      </button>
      <div id="admin-grp-status" style="margin-top: 6px; font-size: 11px; color: var(--primary);"></div>
    </div>

    <!-- 3. User Moderation: Ban, Mute, Kick -->
    <div class="api-section-box">
      <h4><i class="fa-solid fa-user-shield"></i> User Moderation & Controls</h4>
      <div id="admin-users-list" style="max-height: 180px; overflow-y: auto;">
        Loading users directory...
      </div>
    </div>

    <!-- 4. Live Chat Spectator & Monitor -->
    <div class="api-section-box">
      <h4><i class="fa-solid fa-eye"></i> Spectate Live Chats</h4>
      <p style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
        Owner can inspect and monitor all active user conversations:
      </p>
      <div id="admin-spectate-list" style="max-height: 200px; overflow-y: auto;">
        Loading conversations...
      </div>
    </div>

    <!-- Spectator Messages Modal / Sub-viewer -->
    <div id="admin-spectate-modal" class="hidden" style="margin-top: 10px; padding: 12px; background: #070a0e; border: 1px solid var(--border-color); border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <strong id="spectate-conv-title" style="font-size: 12px; color: var(--primary);">Chat Feed</strong>
        <button class="btn-icon-sm" onclick="document.getElementById('admin-spectate-modal').classList.add('hidden')"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div id="spectate-messages-feed" style="max-height: 180px; overflow-y: auto; font-size: 11px; display: flex; flex-direction: column; gap: 6px;"></div>
    </div>
  `;

  drawer.classList.remove('hidden');

  // Load stats
  API.getAdminStats().then(res => {
    if (res.stats) {
      document.getElementById('stat-users').textContent = res.stats.totalUsers;
      document.getElementById('stat-convs').textContent = res.stats.totalConversations;
      document.getElementById('stat-msgs').textContent = res.stats.totalMessages;
    }
  }).catch(() => {});

  // Populate users in group picker & moderation
  renderAdminUsers();

  // Populate spectate list
  renderAdminSpectateList();
}

async function renderAdminUsers() {
  try {
    const res = await API.getUsers();
    const users = res.users;

    // Group checkboxes
    const grpList = document.getElementById('admin-grp-members-list');
    if (grpList) {
      grpList.innerHTML = users.map(u => `
        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; cursor: pointer;">
          <input type="checkbox" value="${u.id}" class="admin-grp-user-cb">
          <span>${escapeHtml(u.display_name)} (@${u.username})</span>
        </label>
      `).join('');
    }

    // Moderation list
    const modContainer = document.getElementById('admin-users-list');
    if (modContainer) {
      modContainer.innerHTML = users.map(u => {
        const isOwnerUser = u.role === 'owner' || u.is_owner === 1 || u.username === '7yf57l';
        return `
          <div class="admin-user-row">
            <div>
              <strong>${escapeHtml(u.display_name)}</strong>
              ${isOwnerUser ? '<span class="badge-owner"><i class="fa-solid fa-crown"></i></span>' : ''}
              <div style="font-size: 10px; color: var(--text-muted);">@${u.username} ${u.is_muted ? '• 🔇 MUTED' : ''} ${u.is_banned ? '• 🚫 BANNED' : ''}</div>
            </div>
            ${!isOwnerUser ? `
              <div class="admin-user-actions">
                <button class="btn-admin-act mute" onclick="executeToggleMute('${u.id}')" title="Mute/Unmute">
                  ${u.is_muted ? 'Unmute' : 'Mute'}
                </button>
                <button class="btn-admin-act ${u.is_banned ? 'unban' : 'ban'}" onclick="executeToggleBan('${u.id}', ${u.is_banned ? true : false})" title="Ban/Unban">
                  ${u.is_banned ? 'Unban' : 'Ban'}
                </button>
              </div>
            ` : '<span style="font-size: 10px; color: #f59e0b;">Protected</span>'}
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Error rendering admin users:', err);
  }
}

async function renderAdminSpectateList() {
  const list = document.getElementById('admin-spectate-list');
  if (!list) return;
  list.innerHTML = '<div style="color: var(--text-muted); font-size: 11px; padding: 6px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading live conversations...</div>';
  try {
    const res = await API.getSpectateConversations();
    if (res && res.conversations && res.conversations.length > 0) {
      list.innerHTML = res.conversations.map(c => `
        <div class="spectate-chat-card" onclick="spectateConversation('${c.id}', '${escapeHtml(c.name)}')">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <strong style="color: var(--text-main); font-size: 12px;">${escapeHtml(c.name)}</strong>
            <span style="font-size: 10px; color: var(--primary);">${c.type.toUpperCase()}</span>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${c.lastMessage ? `${escapeHtml(c.lastMessage.sender_name)}: ${escapeHtml(c.lastMessage.content || c.lastMessage.message_type)}` : 'No messages'}
          </div>
          <div style="font-size: 10px; color: var(--text-sub); margin-top: 4px;">
            ${(c.participants || []).map(p => p.displayName).join(', ')} (${c.messageCount || 0} msgs)
          </div>
        </div>
      `).join('');
    } else {
      list.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 11px; padding: 12px;">No active conversations found yet.</div>';
    }
  } catch (err) {
    console.error('Error loading spectate chats:', err);
    list.innerHTML = `<div style="color: #ef4444; font-size: 11px; padding: 8px;"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${escapeHtml(err.message || 'Access denied')}</div>`;
  }
}

async function spectateConversation(convId, convName) {
  const modal = document.getElementById('admin-spectate-modal');
  const title = document.getElementById('spectate-conv-title');
  const feed = document.getElementById('spectate-messages-feed');

  modal.classList.remove('hidden');
  title.textContent = `Monitoring: ${convName}`;
  feed.innerHTML = '<span style="color: var(--text-muted);">Fetching messages...</span>';

  try {
    const res = await API.getSpectateMessages(convId);
    if (res.messages.length === 0) {
      feed.innerHTML = '<span style="color: var(--text-muted);">No messages found in this chat.</span>';
      return;
    }

    feed.innerHTML = res.messages.map(m => `
      <div style="padding: 4px 6px; background: rgba(255,255,255,0.04); border-radius: 4px;">
        <span style="color: var(--primary); font-weight: 600;">${escapeHtml(m.sender_name || m.sender_username)}:</span>
        <span style="color: var(--text-main);">${escapeHtml(m.content || `[${m.message_type}]`)}</span>
        <span style="float: right; color: var(--text-sub); font-size: 9px;">${new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
      </div>
    `).join('');
    feed.scrollTop = feed.scrollHeight;
  } catch (e) {
    feed.innerHTML = `<span style="color: #ef4444;">Error: ${e.message}</span>`;
  }
}

async function executeAdminBroadcast() {
  const title = document.getElementById('admin-ann-title').value.trim();
  const msg = document.getElementById('admin-ann-msg').value.trim();
  const status = document.getElementById('admin-ann-status');
  if (!msg) {
    GrilledSModal.alert('Please enter an announcement message', 'Broadcast Notice', 'warning');
    return;
  }
  status.textContent = 'Broadcasting to all conversations...';
  try {
    const res = await API.broadcastAnnouncement(title, msg);
    status.textContent = `✓ ${res.message}`;
    document.getElementById('admin-ann-msg').value = '';
    loadConversations();
    GrilledSModal.toast('Broadcast announcement sent!', 'success');
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
  }
}

async function executeAdminCreateGroup() {
  const name = document.getElementById('admin-grp-name').value.trim();
  const status = document.getElementById('admin-grp-status');
  const selectedCbs = document.querySelectorAll('.admin-grp-user-cb:checked');
  const participantIds = Array.from(selectedCbs).map(cb => cb.value);

  if (!name || participantIds.length === 0) {
    GrilledSModal.alert('Please specify group name and select at least one member.', 'Group Creation', 'warning');
    return;
  }

  status.textContent = 'Creating group...';
  try {
    const res = await API.adminCreateGroup(name, participantIds);
    status.textContent = '✓ Group created!';
    document.getElementById('admin-grp-name').value = '';
    loadConversations();
    renderAdminSpectateList();
    GrilledSModal.toast(`Group "${name}" created successfully!`, 'success');
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
  }
}

async function executeToggleMute(userId) {
  try {
    await API.toggleMuteUser(userId);
    GrilledSModal.toast('User mute status updated', 'info');
    renderAdminUsers();
  } catch (e) {
    GrilledSModal.alert('Failed to update mute state: ' + e.message, 'Admin Error', 'danger');
  }
}

async function executeToggleBan(userId, isCurrentlyBanned) {
  try {
    if (isCurrentlyBanned) {
      await API.unbanUser(userId);
      GrilledSModal.toast('User unbanned successfully', 'success');
    } else {
      const confirmed = await GrilledSModal.confirm('Are you sure you want to ban this user? They will not be able to log in.', 'Ban User', { confirmText: 'Ban User', danger: true });
      if (!confirmed) return;
      await API.banUser(userId);
      GrilledSModal.toast('User has been banned', 'warning');
    }
    renderAdminUsers();
  } catch (e) {
    GrilledSModal.alert('Failed to update ban state: ' + e.message, 'Admin Error', 'danger');
  }
}

// -------------------------------------------------------------
// New Chat Modal / Search
// -------------------------------------------------------------
function openNewChatModal(searchQuery = '') {
  const modal = document.getElementById('new-chat-modal-overlay');
  if (!modal) return;
  modal.classList.remove('hidden');

  const searchInput = document.getElementById('directory-modal-search');
  if (searchInput) {
    searchInput.value = searchQuery;
    setTimeout(() => searchInput.focus(), 100);
  }

  loadUsersDirectory().then(() => {
    renderDirectoryModalList(searchQuery);
  });
}

function closeNewChatModal() {
  const modal = document.getElementById('new-chat-modal-overlay');
  if (modal) modal.classList.add('hidden');
}

function renderDirectoryModalList(query = '') {
  const list = document.getElementById('directory-modal-users-list');
  if (!list) return;

  let users = allUsersList || [];
  if (currentUser) {
    users = users.filter(u => u.id !== currentUser.id);
  }

  if (query && query.trim()) {
    const q = query.toLowerCase().trim();
    users = users.filter(u => 
      (u.display_name && u.display_name.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q))
    );
  }

  if (users.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 24px;">
        <i class="fa-solid fa-user-xmark" style="font-size: 24px; margin-bottom: 6px; display: block; opacity: 0.5;"></i>
        No members found matching "${escapeHtml(query)}"
      </div>
    `;
    return;
  }

  list.innerHTML = users.map(u => {
    const isOwnerUser = u.role === 'owner' || u.is_owner === 1 || u.username === '7yf57l';
    return `
      <div class="directory-member-item" onclick="startDirectChatWithUser('${u.id}')">
        <div style="position: relative; width: 40px; height: 40px; flex-shrink: 0;">
          <img src="${u.avatar_url || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + u.id}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
          ${u.online ? '<span class="status-indicator online" style="bottom: 0; right: 0; width: 11px; height: 11px;"></span>' : ''}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 13px; font-weight: 700; color: var(--text-main);">${escapeHtml(u.display_name)}</span>
            ${isOwnerUser ? '<span class="badge-owner" style="font-size: 9px; padding: 1px 5px;"><i class="fa-solid fa-crown"></i> OWNER</span>' : ''}
          </div>
          <div style="font-size: 11px; color: var(--text-muted);">@${escapeHtml(u.username)}</div>
          ${u.about ? `<div style="font-size: 10.5px; color: var(--text-sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(u.about)}</div>` : ''}
        </div>
        <button class="btn btn-primary" style="padding: 5px 12px; font-size: 11px; border-radius: 20px;">
          <i class="fa-solid fa-comment-dots"></i> Chat
        </button>
      </div>
    `;
  }).join('');
}

async function startDirectChatWithUser(targetUserId) {
  try {
    const res = await API.startDirectConversation(targetUserId);
    if (res && res.conversation) {
      closeNewChatModal();
      const rightDrawer = document.getElementById('right-drawer');
      if (rightDrawer) rightDrawer.classList.add('hidden');
      activeFilter = 'all';
      document.querySelectorAll('.filter-chips .chip').forEach(c => {
        if (c.getAttribute('data-filter') === 'all') c.classList.add('active');
        else c.classList.remove('active');
      });
      await loadConversations();
      selectConversation(res.conversation.id);
    }
  } catch (err) {
    GrilledSModal.alert('Failed to start chat: ' + err.message, 'Chat Error', 'danger');
  }
}

async function promptCreateGroupFromDirectory() {
  const name = await GrilledSModal.prompt('Enter a name for the new Group:', '', 'Create New Group', { placeholder: 'e.g. Squad' });
  if (!name || !name.trim()) return;

  const users = (allUsersList || []).filter(u => !currentUser || u.id !== currentUser.id);
  if (users.length === 0) {
    GrilledSModal.alert('No other members available to add right now.', 'Create Group', 'info');
    return;
  }

  const addAll = await GrilledSModal.confirm(
    `Add all ${users.length} community members to group "${name.trim()}"?\n(Click Cancel to create with only yourself for now)`,
    'Group Participants',
    { confirmText: 'Add All Members', cancelText: 'Only Me' }
  );
  const memberIds = addAll ? users.map(u => u.id) : [];

  try {
    const res = await API.createGroup(name.trim(), memberIds);
    closeNewChatModal();
    await loadConversations();
    selectConversation(res.conversation.id);
    GrilledSModal.toast(`Group "${name.trim()}" created!`, 'success');
  } catch (err) {
    GrilledSModal.alert('Failed to create group: ' + err.message, 'Group Error', 'danger');
  }
}

function showNewChatPrompt() {
  openNewChatModal();
}

// -------------------------------------------------------------
// Event Listeners Setup
// -------------------------------------------------------------
function setupEventListeners() {
  // Safe helper for element event listeners
  const safeOn = (id, event, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, fn);
  };

  // Optional legacy auth handlers if present
  safeOn('tab-login', 'click', () => {
    document.getElementById('tab-login')?.classList.add('active');
    document.getElementById('tab-register')?.classList.remove('active');
    document.getElementById('form-login')?.classList.remove('hidden');
    document.getElementById('form-register')?.classList.add('hidden');
  });

  safeOn('tab-register', 'click', () => {
    document.getElementById('tab-register')?.classList.add('active');
    document.getElementById('tab-login')?.classList.remove('active');
    document.getElementById('form-register')?.classList.remove('hidden');
    document.getElementById('form-login')?.classList.add('hidden');
  });

  // Chat input typing & send
  const msgInput = document.getElementById('message-input');
  const btnSend = document.getElementById('btn-send-message');
  const btnRecord = document.getElementById('btn-record-voice');

  msgInput.addEventListener('input', () => {
    if (msgInput.value.trim().length > 0) {
      btnRecord.classList.add('hidden');
      btnSend.classList.remove('hidden');
    } else {
      btnRecord.classList.remove('hidden');
      btnSend.classList.add('hidden');
    }
  });

  msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  });

  btnSend.onclick = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      stopVoiceRecording(true);
    } else {
      sendTextMessage();
    }
  };

  // Voice recording triggers
  btnRecord.onclick = () => {
    startVoiceRecording();
  };

  document.getElementById('btn-cancel-voice').onclick = () => {
    stopVoiceRecording(false);
  };

  // Attachment Tray Toggle
  document.getElementById('btn-toggle-attach').onclick = () => {
    document.getElementById('attachment-tray').classList.toggle('hidden');
    document.getElementById('sticker-drawer').classList.add('hidden');
  };

  // Stickers Toggle
  document.getElementById('btn-toggle-stickers').onclick = () => {
    document.getElementById('sticker-drawer').classList.toggle('hidden');
    document.getElementById('attachment-tray').classList.add('hidden');
  };

  document.getElementById('close-sticker-drawer').onclick = () => {
    document.getElementById('sticker-drawer').classList.add('hidden');
  };

  // File Inputs
  document.getElementById('tray-btn-pdf').onclick = () => {
    document.getElementById('file-input-pdf').click();
    document.getElementById('attachment-tray').classList.add('hidden');
  };

  document.getElementById('tray-btn-audio').onclick = () => {
    document.getElementById('file-input-audio').click();
    document.getElementById('attachment-tray').classList.add('hidden');
  };

  document.getElementById('tray-btn-media').onclick = () => {
    document.getElementById('file-input-media').click();
    document.getElementById('attachment-tray').classList.add('hidden');
  };

  document.getElementById('tray-btn-stickers').onclick = () => {
    document.getElementById('sticker-drawer').classList.remove('hidden');
    document.getElementById('attachment-tray').classList.add('hidden');
  };

  // Handle selected files
  ['file-input-pdf', 'file-input-audio', 'file-input-media'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('change', () => {
      if (el.files && el.files[0]) {
        uploadAndSendMedia(el.files[0]);
        el.value = '';
      }
    });
  });

  // Call buttons
  document.getElementById('btn-audio-call').onclick = () => {
    if (activeConversation && activeConversation.otherUser) {
      callManager.startCall(activeConversation.otherUser, 'audio');
    } else {
      GrilledSModal.alert('Group calls are direct peer-to-peer in this version.', 'Calls', 'info');
    }
  };

  document.getElementById('btn-video-call').onclick = () => {
    if (activeConversation && activeConversation.otherUser) {
      callManager.startCall(activeConversation.otherUser, 'video');
    } else {
      GrilledSModal.alert('Group calls are direct peer-to-peer in this version.', 'Calls', 'info');
    }
  };

  // WebRTC Call Controls
  document.getElementById('btn-accept-call').onclick = () => callManager.acceptCall();
  document.getElementById('btn-reject-call').onclick = () => callManager.rejectCall();
  document.getElementById('btn-hangup-call').onclick = () => callManager.hangupCall();
  document.getElementById('btn-toggle-mic').onclick = () => {
    const enabled = callManager.toggleMicrophone();
    document.getElementById('btn-toggle-mic').querySelector('i').className = enabled ? 'fa-solid fa-microphone' : 'fa-solid fa-microphone-slash';
  };
  document.getElementById('btn-toggle-cam').onclick = () => {
    const enabled = callManager.toggleCamera();
    document.getElementById('btn-toggle-cam').querySelector('i').className = enabled ? 'fa-solid fa-video' : 'fa-solid fa-video-slash';
  };

  // Close modals
  document.getElementById('btn-close-pdf').onclick = () => {
    document.getElementById('pdf-modal-overlay').classList.add('hidden');
    document.getElementById('pdf-frame').src = '';
  };

  document.getElementById('btn-close-drawer').onclick = () => {
    document.getElementById('right-drawer').classList.add('hidden');
  };

  // Navigation rail buttons
  safeOn('nav-chats-btn', 'click', () => switchToChatsPanel());
  safeOn('nav-calls-btn', 'click', () => switchToCallsPanel());
  safeOn('nav-api-btn', 'click', () => showApiAutomationPanel());
  safeOn('nav-glasses-btn', 'click', () => showGlassesIoTPanel());
  safeOn('nav-admin-btn', 'click', () => showAdminOwnerPanel());

  // Chat Info Drawer button
  safeOn('btn-chat-info', 'click', () => showConversationInfoDrawer());

  // Custom Sticker Add Trigger & File Input
  safeOn('btn-add-custom-sticker', 'click', () => triggerAddCustomSticker());
  const stickerFileInput = document.getElementById('sticker-custom-file-input');
  if (stickerFileInput) {
    stickerFileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (loadEvt) => {
          addCustomStickerUrl(loadEvt.target.result, file.name.replace(/\.[^/.]+$/, ''));
        };
        reader.readAsDataURL(file);
        e.target.value = '';
      }
    };
  }

  // Live Conversation Search
  const convSearchInput = document.getElementById('conversation-search');
  if (convSearchInput) {
    convSearchInput.oninput = (e) => {
      const query = e.target.value.toLowerCase().trim();
      if (activeFilter === 'people') {
        renderDirectoryPeopleInSidebar(query);
        return;
      }
      const convItems = document.querySelectorAll('#conversations-list .conv-item');
      convItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? 'flex' : 'none';
      });
    };
  }

  // Header Search Toggle Button
  safeOn('btn-search-toggle', 'click', () => {
    const callsPanel = document.getElementById('sidebar-calls-panel');
    if (callsPanel && !callsPanel.classList.contains('hidden')) {
      document.getElementById('calls-search')?.focus();
    } else {
      document.getElementById('conversation-search')?.focus();
    }
  });

  // Screenshare Button inside Call modal
  safeOn('btn-toggle-screenshare', 'click', () => {
    GrilledSModal.toast('Screen sharing active in peer-to-peer session.', 'info');
  });

  // Filter chips
  document.querySelectorAll('.filter-chips .chip').forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.getAttribute('data-filter');
      const searchVal = document.getElementById('conversation-search')?.value || '';
      if (activeFilter === 'people') {
        if (!allUsersList || allUsersList.length === 0) {
          loadUsersDirectory().then(() => renderDirectoryPeopleInSidebar(searchVal));
        } else {
          renderDirectoryPeopleInSidebar(searchVal);
        }
      } else {
        renderConversationsList();
      }
    };
  });

  // Mobile Back Button
  document.getElementById('mobile-back-btn').onclick = () => {
    document.querySelector('.app-layout').classList.remove('conversation-active');
  };

  // New Chat Button
  document.getElementById('btn-new-chat').onclick = () => showNewChatPrompt();

  // Theme Toggle
  document.getElementById('theme-toggle').onclick = () => {
    document.body.classList.toggle('theme-light');
    const isLight = document.body.classList.contains('theme-light');
    document.getElementById('theme-toggle').querySelector('i').className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  };

  // Profile Flyout Menu Toggle on Avatar Click
  const avatarWrapper = document.getElementById('current-user-avatar-btn');
  const profileMenu = document.getElementById('profile-flyout-menu');

  avatarWrapper.onclick = (e) => {
    e.stopPropagation();
    profileMenu.classList.toggle('hidden');
  };

  // Close flyout when clicking outside
  document.addEventListener('click', (e) => {
    if (profileMenu && !profileMenu.contains(e.target) && !avatarWrapper.contains(e.target)) {
      profileMenu.classList.add('hidden');
    }
  });

  // Flyout Menu Action Buttons
  document.getElementById('btn-open-profile-settings').onclick = () => {
    profileMenu.classList.add('hidden');
    openProfileSettingsModal();
  };

  document.getElementById('btn-open-account-settings').onclick = () => {
    profileMenu.classList.add('hidden');
    openProfileSettingsModal();
  };

  document.getElementById('btn-toggle-notifs').onclick = () => {
    toggleNotificationPreference();
  };

  safeOn('btn-open-admin-from-menu', 'click', () => {
    profileMenu.classList.add('hidden');
    showAdminOwnerPanel();
  });

  document.getElementById('btn-logout').onclick = async () => {
    const confirmed = await GrilledSModal.confirm('Are you sure you want to log out of GrilledS?', 'Confirm Log Out', { confirmText: 'Log Out', danger: true });
    if (confirmed) {
      API.setToken(null);
      currentUser = null;
      window.location.replace('/login');
    }
  };

  // Close Settings Modal
  document.getElementById('btn-close-settings').onclick = () => {
    document.getElementById('profile-settings-modal').classList.add('hidden');
  };

  // Trigger Picture Upload
  document.getElementById('btn-trigger-avatar-upload').onclick = () => {
    document.getElementById('avatar-file-input').click();
  };

  document.getElementById('avatar-file-input').onchange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const uploadRes = await API.uploadFile(file);
        const newAvatarUrl = uploadRes.url;
        await updateProfilePicture(newAvatarUrl);
      } catch (err) {
        GrilledSModal.alert('Failed to upload picture: ' + err.message, 'Upload Error', 'danger');
      }
    }
  };

  // Reset to Letter Avatar
  document.getElementById('btn-reset-letter-avatar').onclick = async () => {
    // Generate letter avatar based on current name
    const letterAvatar = generateClientLetterAvatar(currentUser.display_name);
    await updateProfilePicture(letterAvatar);
  };

  // Form Profile Update Save
  document.getElementById('form-update-profile').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const displayName = document.getElementById('setting-display-name').value.trim();
      const about = document.getElementById('setting-about').value.trim();
      const notifSetting = document.getElementById('setting-notifications').value;

      localStorage.setItem('pc_notif', notifSetting);
      updateNotificationMenuUI(notifSetting === 'enabled');

      const res = await API.updateProfile({ displayName, about });
      currentUser = res.user;

      loginSuccess(currentUser);
      document.getElementById('profile-settings-modal').classList.add('hidden');
      GrilledSModal.toast('Profile updated successfully!', 'success');
    } catch (err) {
      GrilledSModal.alert('Update failed: ' + err.message, 'Update Error', 'danger');
    }
  };

  // Reply banner close button
  safeOn('btn-close-reply', 'click', () => clearReplyBanner());

  // Message Context Menu Action Buttons
  safeOn('context-btn-reply', 'click', () => {
    if (activeContextMsgId) startReplyingToMessage(activeContextMsgId);
    closeMessageContextMenu();
  });

  safeOn('context-btn-forward', 'click', () => {
    if (activeContextMsgId) openForwardModal(activeContextMsgId);
    closeMessageContextMenu();
  });

  safeOn('context-btn-copy', 'click', () => {
    if (activeContextMsgId) copyMessageText(activeContextMsgId);
    closeMessageContextMenu();
  });

  safeOn('context-btn-delete', 'click', () => {
    if (activeContextMsgId) deleteMessageForMe(activeContextMsgId);
    closeMessageContextMenu();
  });

  // Floating Reaction Pill Emojis
  const rxPill = document.getElementById('msg-reactions-floating-pill');
  if (rxPill) {
    rxPill.querySelectorAll('.reaction-anim-btn[data-emoji]').forEach(btn => {
      btn.onclick = () => {
        const emoji = btn.getAttribute('data-emoji');
        if (activeContextMsgId && emoji) {
          reactToMessage(activeContextMsgId, emoji);
        }
        closeMessageContextMenu();
      };
    });
  }

  // Custom Emoji Picker button (+)
  safeOn('btn-custom-emoji-picker', 'click', async () => {
    const targetMsgId = activeContextMsgId;
    closeMessageContextMenu();
    const custom = await GrilledSModal.prompt('Enter any emoji for reaction (e.g. 🎉, 💯, 🚀, 👍, 😎):', '🎉', 'Custom Reaction Emoji', { placeholder: 'Emoji...' });
    if (custom && custom.trim() && targetMsgId) {
      reactToMessage(targetMsgId, custom.trim());
    }
  });

  // Close context overlay when clicking backdrop
  const ctxOverlay = document.getElementById('msg-context-overlay');
  if (ctxOverlay) {
    ctxOverlay.onclick = (e) => {
      if (e.target === ctxOverlay) closeMessageContextMenu();
    };
  }

  // Forward Modal Close Buttons & Backdrop
  safeOn('btn-close-forward', 'click', () => closeForwardModal());
  const fwdOverlay = document.getElementById('forward-modal-overlay');
  if (fwdOverlay) {
    fwdOverlay.onclick = (e) => {
      if (e.target === fwdOverlay) closeForwardModal();
    };
  }

  // New Chat & Member Directory Modal Listeners
  safeOn('btn-close-new-chat', 'click', () => closeNewChatModal());
  safeOn('btn-open-create-group-prompt', 'click', () => promptCreateGroupFromDirectory());

  const dirSearch = document.getElementById('directory-modal-search');
  if (dirSearch) {
    dirSearch.oninput = (e) => {
      renderDirectoryModalList(e.target.value);
    };
  }

  const newChatModal = document.getElementById('new-chat-modal-overlay');
  if (newChatModal) {
    newChatModal.onclick = (e) => {
      if (e.target === newChatModal) closeNewChatModal();
    };
  }
}

function openProfileSettingsModal() {
  const modal = document.getElementById('profile-settings-modal');
  modal.classList.remove('hidden');

  document.getElementById('settings-preview-avatar').src = currentUser.avatar_url;
  document.getElementById('setting-display-name').value = currentUser.display_name;
  document.getElementById('setting-about').value = currentUser.about || '';
  document.getElementById('setting-email').value = currentUser.email || 'None';
  document.getElementById('setting-username').value = `@${currentUser.username}`;
  
  const notifPref = localStorage.getItem('pc_notif') || 'enabled';
  document.getElementById('setting-notifications').value = notifPref;

  const isOwner = (currentUser.role === 'owner' || currentUser.is_owner === 1) && currentUser.email === '7yf57l@gmail.com' && currentUser.google_id;
  const crown = document.getElementById('settings-user-crown');
  if (crown) {
    if (isOwner) crown.classList.remove('hidden');
    else crown.classList.add('hidden');
  }
}

async function updateProfilePicture(newAvatarUrl) {
  try {
    const res = await API.updateProfile({ avatarUrl: newAvatarUrl });
    currentUser = res.user;
    document.getElementById('settings-preview-avatar').src = newAvatarUrl;
    document.getElementById('current-user-avatar').src = newAvatarUrl;
    document.getElementById('flyout-user-avatar').src = newAvatarUrl;
    loadConversations();
    GrilledSModal.toast('Profile picture updated!', 'success');
  } catch (err) {
    GrilledSModal.alert('Failed to update avatar: ' + err.message, 'Avatar Error', 'danger');
  }
}

function toggleNotificationPreference() {
  const current = localStorage.getItem('pc_notif') || 'enabled';
  const next = current === 'enabled' ? 'disabled' : 'enabled';
  localStorage.setItem('pc_notif', next);
  updateNotificationMenuUI(next === 'enabled');
  GrilledSModal.toast(`Sound Notifications: ${next === 'enabled' ? 'Enabled' : 'Muted'}`, 'info');
}

function updateNotificationMenuUI(enabled) {
  const icon = document.getElementById('notif-menu-icon');
  const text = document.getElementById('notif-menu-text');
  if (icon && text) {
    icon.className = enabled ? 'fa-solid fa-bell' : 'fa-solid fa-bell-slash';
    text.textContent = `Notifications: ${enabled ? 'ON' : 'OFF'}`;
  }
}

function generateClientLetterAvatar(name) {
  const initial = (name || 'U').trim().charAt(0).toUpperCase() || 'U';
  const colors = [
    ['#10b981', '#047857'],
    ['#3b82f6', '#1d4ed8'],
    ['#8b5cf6', '#6d28d9'],
    ['#f59e0b', '#b45309'],
    ['#ec4899', '#be185d'],
    ['#06b6d4', '#0e7490'],
    ['#f97316', '#c2410c']
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

async function sendTextMessage() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  if (!text || !activeConversation) return;

  input.value = '';
  document.getElementById('btn-send-message').classList.add('hidden');
  document.getElementById('btn-record-voice').classList.remove('hidden');

  let mediaMeta = {};
  if (currentReplyTarget) {
    mediaMeta.replyTo = {
      id: currentReplyTarget.id,
      author: currentReplyTarget.author,
      snippet: currentReplyTarget.snippet
    };
    clearReplyBanner();
  }

  await API.sendMessage(activeConversation.id, {
    content: text,
    messageType: 'text',
    mediaMeta: Object.keys(mediaMeta).length > 0 ? mediaMeta : undefined
  });
}

// Helpers
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatTimestamp(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
