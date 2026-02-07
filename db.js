const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'notify-me.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const stmts = {
  insertUser: db.prepare('INSERT INTO users (id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)'),
  getUser: db.prepare('SELECT * FROM users WHERE id = ?'),
  deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
  insertMessage: db.prepare('INSERT INTO messages (user_id, payload) VALUES (?, ?)'),
  getMessages: db.prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC'),
  deleteMessages: db.prepare('DELETE FROM messages WHERE user_id = ?'),
  cleanupOldMessages: db.prepare("DELETE FROM messages WHERE created_at < datetime('now', '-7 days')"),
};

module.exports = {
  addUser(id, subscription) {
    stmts.insertUser.run(id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
  },
  getUser(id) {
    return stmts.getUser.get(id);
  },
  deleteUser(id) {
    stmts.deleteUser.run(id);
  },
  addMessage(userId, payload) {
    stmts.insertMessage.run(userId, JSON.stringify(payload));
  },
  getMessages(userId) {
    return stmts.getMessages.all(userId);
  },
  deleteMessages(userId) {
    stmts.deleteMessages.run(userId);
  },
  cleanupOldMessages() {
    stmts.cleanupOldMessages.run();
  },
  close() {
    db.close();
  },
};
