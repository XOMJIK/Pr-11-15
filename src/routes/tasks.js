const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { z }   = require('zod');
const jwt     = require('jsonwebtoken');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'Не авторизовано' });
  try {
    req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Невірний токен' });
  }
}

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|doc|docx/;
    allowed.test(path.extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(new Error('Непідтримуваний тип файлу'));
  },
});

const createTaskSchema = z.object({
  title:       z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  status:      z.enum(['open', 'done']).optional(),
  priority:    z.number().int().min(1).max(5).optional(),
});

const updateTaskSchema = z.object({
  title:       z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  status:      z.enum(['open', 'done']).optional(),
  priority:    z.number().int().min(1).max(5).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'Потрібно передати хоча б одне поле',
});

router.post('/', auth, async (req, res, next) => {
  try {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Некоректні дані', errors: parsed.error.errors });

    const { title, description = '', status = 'open', priority = 3 } = parsed.data;
    const [result] = await db.query(
      'INSERT INTO tasks (title, description, status, priority, userId) VALUES (?, ?, ?, ?, ?)',
      [title, description, status, priority, req.user.id]
    );
    const [[task]] = await db.query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: task });
  } catch (err) { next(err); }
});

router.get('/', auth, async (req, res, next) => {
  try {
    const {
      status, priority, search,
      sort = 'createdAt', order = 'desc',
      page = 1, limit = 10,
    } = req.query;

    const conditions = ['userId = ?'];
    const values     = [req.user.id];

    if (status)   { conditions.push('status = ?');   values.push(status); }
    if (priority) { conditions.push('priority = ?'); values.push(parseInt(priority)); }
    if (search)   {
      conditions.push('(title LIKE ? OR description LIKE ?)');
      values.push(`%${search}%`, `%${search}%`);
    }

    const where    = conditions.join(' AND ');
    const sortCol  = ['createdAt', 'priority'].includes(sort) ? sort : 'createdAt';
    const sortDir  = order === 'asc' ? 'ASC' : 'DESC';
    const offset   = (parseInt(page) - 1) * parseInt(limit);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM tasks WHERE ${where}`, values
    );
    const [tasks] = await db.query(
      `SELECT * FROM tasks WHERE ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
      [...values, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: tasks,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
});

router.get('/:id', auth, async (req, res, next) => {
  try {
    const [[task]] = await db.query(
      'SELECT * FROM tasks WHERE id = ? AND userId = ?',
      [req.params.id, req.user.id]
    );
    if (!task) return res.status(404).json({ message: 'Задачу не знайдено' });
    res.json({ success: true, data: task });
  } catch (err) { next(err); }
});

router.patch('/:id', auth, async (req, res, next) => {
  try {
    const [[task]] = await db.query(
      'SELECT * FROM tasks WHERE id = ? AND userId = ?',
      [req.params.id, req.user.id]
    );
    if (!task) return res.status(404).json({ message: 'Задачу не знайдено' });

    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Некоректні дані', errors: parsed.error.errors });

    const fields = Object.keys(parsed.data).map(k => `${k} = ?`).join(', ');
    const vals   = [...Object.values(parsed.data), req.params.id];
    await db.query(`UPDATE tasks SET ${fields} WHERE id = ?`, vals);

    const [[updated]] = await db.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/:id', auth, async (req, res, next) => {
  try {
    const [[task]] = await db.query(
      'SELECT * FROM tasks WHERE id = ? AND userId = ?',
      [req.params.id, req.user.id]
    );
    if (!task) return res.status(404).json({ message: 'Задачу не знайдено' });

    await db.query('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Задачу видалено' });
  } catch (err) { next(err); }
});

router.post('/:id/attachments', auth, upload.array('files', 3), async (req, res, next) => {
  try {
    const [[task]] = await db.query(
      'SELECT * FROM tasks WHERE id = ? AND userId = ?',
      [req.params.id, req.user.id]
    );
    if (!task) return res.status(404).json({ message: 'Задачу не знайдено' });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Файли не передано' });
    }

    const inserted = [];
    for (const file of req.files) {
      const [result] = await db.query(
        'INSERT INTO attachments (taskId, filename, path, mimetype, size) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, file.originalname, file.path, file.mimetype, file.size]
      );
      inserted.push({ id: result.insertId, filename: file.originalname, size: file.size, mimetype: file.mimetype });
    }

    res.status(201).json({ success: true, data: inserted });
  } catch (err) { next(err); }
});

router.get('/:id/attachments', auth, async (req, res, next) => {
  try {
    const [[task]] = await db.query(
      'SELECT * FROM tasks WHERE id = ? AND userId = ?',
      [req.params.id, req.user.id]
    );
    if (!task) return res.status(404).json({ message: 'Задачу не знайдено' });

    const [attachments] = await db.query(
      'SELECT * FROM attachments WHERE taskId = ?',
      [req.params.id]
    );
    res.json({ success: true, data: attachments });
  } catch (err) { next(err); }
});

module.exports = router;