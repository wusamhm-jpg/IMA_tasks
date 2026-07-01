// db.js — إعداد قاعدة البيانات باستخدام وحدة node:sqlite المدمجة في Node.js
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'ima_tasks.db');
const db = new DatabaseSync(dbPath);

// إنشاء جدول التصنيفات
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#0EA5A4'
  );
`);

// إنشاء جدول المهام
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category_id INTEGER,
    priority TEXT NOT NULL DEFAULT 'medium',
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  );
`);

// إدراج تصنيفات افتراضية إن لم تكن موجودة
const countRow = db.prepare('SELECT COUNT(*) AS c FROM categories').get();
if (countRow.c === 0) {
  const insertCat = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)');
  insertCat.run('عام', '#0EA5A4');
  insertCat.run('عمل', '#1E3A5F');
  insertCat.run('دراسة', '#F59E0B');
  insertCat.run('شخصي', '#8B5CF6');
}

module.exports = db;
