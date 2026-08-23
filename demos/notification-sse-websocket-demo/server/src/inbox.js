// Inbox ben: luu notification cho user dang offline (khong co instance nao
// trong presence set), de gui lai khi ho ket noi lai. Dung SQLite (file, khong
// can them service Docker) thay vi Redis - Redis pub/sub o day chi cho "live
// push", con inbox can mot noi luu that su ben vung, doc/query duoc, dung
// dung vai tro cua mot DB thay vi lam dung message broker cho viec nay.
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.INBOX_DB_PATH || path.join(__dirname, '..', 'data', 'notifications.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
// WAL: cho phep nhieu process (2 instance server cung mount chung 1 file db)
// doc/ghi dong thoi ma khong khoa ca file nhu journal mode mac dinh.
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS inbox_notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    delivered_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_inbox_user_undelivered
    ON inbox_notifications (user_id, delivered_at);
`);

const insertStmt = db.prepare(`
  INSERT INTO inbox_notifications (id, user_id, title, message, type, created_at)
  VALUES (@id, @userId, @title, @message, @type, @createdAt)
`);

const undeliveredStmt = db.prepare(`
  SELECT id, user_id AS userId, title, message, type, created_at AS createdAt
  FROM inbox_notifications
  WHERE user_id = ? AND delivered_at IS NULL
  ORDER BY created_at ASC
`);

function saveToInbox(notification) {
  insertStmt.run(notification);
}

function getUndelivered(userId) {
  return undeliveredStmt.all(userId);
}

function markDelivered(ids) {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE inbox_notifications SET delivered_at = ? WHERE id IN (${placeholders})`).run(
    new Date().toISOString(),
    ...ids
  );
}

module.exports = { saveToInbox, getUndelivered, markDelivered };
