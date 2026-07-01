// server.js — خادم Backend لتطبيق ima لإدارة المهام
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- التصنيفات (Categories) ----------

// جلب كل التصنيفات
app.get('/api/categories', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM categories ORDER BY id').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إضافة تصنيف جديد
app.post('/api/categories', (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'اسم التصنيف مطلوب' });
    }
    const stmt = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)');
    const info = stmt.run(name.trim(), color || '#0EA5A4');
    const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: 'هذا التصنيف موجود مسبقاً أو حدث خطأ' });
  }
});

// حذف تصنيف
app.delete('/api/categories/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- المهام (Tasks) ----------

// جلب كل المهام مع بيانات التصنيف، مع دعم الفلاتر
app.get('/api/tasks', (req, res) => {
  try {
    const { status, category_id, priority, search } = req.query;
    let query = `
      SELECT tasks.*, categories.name AS category_name, categories.color AS category_color
      FROM tasks
      LEFT JOIN categories ON tasks.category_id = categories.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND tasks.status = ?';
      params.push(status);
    }
    if (category_id) {
      query += ' AND tasks.category_id = ?';
      params.push(category_id);
    }
    if (priority) {
      query += ' AND tasks.priority = ?';
      params.push(priority);
    }
    if (search) {
      query += ' AND (tasks.title LIKE ? OR tasks.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY (tasks.due_date IS NULL), tasks.due_date ASC, tasks.id DESC';

    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إحصائيات سريعة للوحة التحكم
app.get('/api/tasks/stats', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) AS c FROM tasks').get().c;
    const done = db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE status = 'done'").get().c;
    const pending = db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE status = 'pending'").get().c;
    const overdue = db.prepare(
      "SELECT COUNT(*) AS c FROM tasks WHERE status != 'done' AND due_date IS NOT NULL AND date(due_date) < date('now')"
    ).get().c;
    res.json({ total, done, pending, overdue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إضافة مهمة جديدة
app.post('/api/tasks', (req, res) => {
  try {
    const { title, description, category_id, priority, due_date } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'عنوان المهمة مطلوب' });
    }
    const stmt = db.prepare(`
      INSERT INTO tasks (title, description, category_id, priority, due_date, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `);
    const info = stmt.run(
      title.trim(),
      description || '',
      category_id || null,
      priority || 'medium',
      due_date || null
    );
    const created = db.prepare(`
      SELECT tasks.*, categories.name AS category_name, categories.color AS category_color
      FROM tasks LEFT JOIN categories ON tasks.category_id = categories.id
      WHERE tasks.id = ?
    `).get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تعديل مهمة (بيانات أو حالة)
app.put('/api/tasks/:id', (req, res) => {
  try {
    const { title, description, category_id, priority, due_date, status } = req.body;
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'المهمة غير موجودة' });

    const stmt = db.prepare(`
      UPDATE tasks SET
        title = ?, description = ?, category_id = ?, priority = ?, due_date = ?, status = ?
      WHERE id = ?
    `);
    stmt.run(
      title ?? existing.title,
      description ?? existing.description,
      category_id ?? existing.category_id,
      priority ?? existing.priority,
      due_date ?? existing.due_date,
      status ?? existing.status,
      req.params.id
    );

    const updated = db.prepare(`
      SELECT tasks.*, categories.name AS category_name, categories.color AS category_color
      FROM tasks LEFT JOIN categories ON tasks.category_id = categories.id
      WHERE tasks.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// حذف مهمة
app.delete('/api/tasks/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ خادم ima Tasks يعمل على المنفذ ${PORT}`);
});
