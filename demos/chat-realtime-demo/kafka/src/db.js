// SQLite dung CHUNG cho ca 4 bien the (socketio+redis, redis streams, kafka,
// mqtt) qua 1 Docker volume duy nhat: lich su hoi thoai phai giong het nhau du
// dang xem qua co che fanout nao, vi persistence khong phu thuoc vao co che
// push realtime - cung mot bai hoc da rut ra o notification-sse-websocket-demo.
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.CHAT_DB_PATH || path.join(__dirname, '..', 'data', 'chat.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
// WAL + busy_timeout: 8 process (2 instance x 4 bien the) cung mount chung 1
// file db, can cho phep doc/ghi dong thoi va tu cho khi bi khoa thay vi loi ngay.
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages (conversation_id, id);
`);

const insertStmt = db.prepare(`
  INSERT INTO messages (conversation_id, sender_id, recipient_id, body)
  VALUES (@conversationId, @senderId, @recipientId, @body)
  RETURNING id, conversation_id AS conversationId, sender_id AS senderId,
            recipient_id AS recipientId, body, created_at AS createdAt
`);

const historyStmt = db.prepare(`
  SELECT id, conversation_id AS conversationId, sender_id AS senderId,
         recipient_id AS recipientId, body, created_at AS createdAt
  FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?
`);

function conversationId(a, b) {
  return [a, b].sort().join(':');
}

function saveMessage({ senderId, recipientId, body }) {
  return insertStmt.get({
    conversationId: conversationId(senderId, recipientId),
    senderId,
    recipientId,
    body,
  });
}

function getHistory(a, b, limit = 50) {
  return historyStmt.all(conversationId(a, b), limit).reverse();
}

module.exports = { conversationId, saveMessage, getHistory };
