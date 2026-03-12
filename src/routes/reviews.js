const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { z }   = require('zod');

const jwt = require('jsonwebtoken');
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

router.get('/:productId', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.id, r.rating, r.text, r.created_at,
              u.first_name, u.last_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.productId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text:   z.string().min(3).max(1000),
});

router.post('/:productId', auth, async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Некоректні дані', errors: parsed.error.errors });
  }

  const { rating, text } = parsed.data;
  const productId = parseInt(req.params.productId);
  const userId    = req.user.id;

  try {
    await db.query(
      'INSERT INTO reviews (product_id, user_id, rating, text) VALUES (?, ?, ?, ?)',
      [productId, userId, rating, text]
    );

    const [[avg]] = await db.query(
      'SELECT ROUND(AVG(rating), 1) AS avg_rating FROM reviews WHERE product_id = ?',
      [productId]
    );
    await db.query(
      'UPDATE products SET rating = ? WHERE id = ?',
      [avg.avg_rating, productId]
    );

    res.status(201).json({ success: true, message: 'Відгук додано' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ви вже залишили відгук на цей товар' });
    }
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const [[review]] = await db.query('SELECT user_id FROM reviews WHERE id = ?', [req.params.id]);
    if (!review) return res.status(404).json({ message: 'Відгук не знайдено' });
    if (review.user_id !== req.user.id) return res.status(403).json({ message: 'Немає доступу' });

    await db.query('DELETE FROM reviews WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

module.exports = router;