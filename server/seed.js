const userService = require('./services/userService');
const chatService = require('./services/chatService');
const db = require('./db');

function ensureSystemAccounts() {
  // Ensure the primary System Owner account exists
  const ownerUser = {
    username: '7yf57l',
    email: '7yf57l@gmail.com',
    name: '7yf57l',
    pass: 'owner123'
  };

  let existing = userService.getUserByUsername(ownerUser.username);
  if (!existing) {
    try {
      existing = userService.createUser(ownerUser.username, ownerUser.name, ownerUser.pass, ownerUser.email);
      console.log(`✓ Created System Owner: ${ownerUser.username} (Crown: YES)`);
    } catch (e) {
      console.error(`Failed to create owner account:`, e.message);
    }
  }

  // Ensure owner status and avatar are maintained
  if (existing) {
    db.update('users', user => user.id === existing.id, {
      role: 'owner',
      is_owner: 1,
      email: '7yf57l@gmail.com',
      avatar_url: userService.generateLetterAvatar('7yf57l')
    });
  }

  // Ensure Everyone group exists and includes all registered users
  chatService.ensureEveryoneGroup();
}

ensureSystemAccounts();
