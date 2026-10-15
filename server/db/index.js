const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

class JsonStore {
  constructor(filename, initial = {}) {
    this.filepath = path.join(dataDir, `${filename}.json`);
    this.data = initial;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filepath)) {
        const raw = fs.readFileSync(this.filepath, 'utf8');
        this.data = JSON.parse(raw);
      } else {
        this.save();
      }
    } catch (e) {
      console.error(`Failed to load ${this.filepath}, creating fresh store:`, e.message);
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(this.filepath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error(`Failed to save ${this.filepath}:`, e.message);
    }
  }

  get(collection) {
    if (!this.data[collection]) {
      this.data[collection] = [];
    }
    return this.data[collection];
  }

  find(collection, predicate) {
    return this.get(collection).find(predicate) || null;
  }

  filter(collection, predicate) {
    return this.get(collection).filter(predicate);
  }

  insert(collection, item) {
    this.get(collection).push(item);
    this.save();
    return item;
  }

  update(collection, predicate, updates) {
    const list = this.get(collection);
    let updatedCount = 0;
    for (let i = 0; i < list.length; i++) {
      if (predicate(list[i])) {
        list[i] = { ...list[i], ...updates };
        updatedCount++;
      }
    }
    if (updatedCount > 0) this.save();
    return updatedCount;
  }
}

const db = new JsonStore('pulsechat_db', {
  users: [],
  conversations: [],
  participants: [],
  messages: [],
  calls: [],
  webhooks: []
});

console.log('PulseChat JSON Store initialized cleanly with zero native compilation dependencies.');

module.exports = db;
