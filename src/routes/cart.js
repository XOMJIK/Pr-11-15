const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { AppError } = require('../middleware/errorHandler');

// Middleware — перевірка токена
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) throw new AppError('Необхідна авторизація', 401);

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    throw new AppError('Невірний токен', 401);
  }
};

// GET /api/cart — отримати кошик
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const [items] = await pool.query(`
      SELECT ci.id, ci.quantity,
             p.id as product_id, p.name, p.price, p.image
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?
    `, [req.user.id]);

    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    res.json({ status: 'success', data: items, total });
  } catch (err) {
    next(err);
  }
});

// POST /api/cart — додати товар
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { product_id, quantity = 1 } = req.body;

    if (!product_id) throw new AppError('product_id обовʼязковий', 400);

    const [product] = await pool.query(
      'SELECT id FROM products WHERE id = ?', [product_id]
    );
    if (product.length === 0) throw new AppError('Товар не знайдено', 404);

    // Якщо вже є — збільшуємо кількість
    const [existing] = await pool.query(
      'SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?',
      [req.user.id, product_id]
    );

    if (existing.length > 0) {
      await pool.query(
        'UPDATE cart_items SET quantity = quantity + ? WHERE id = ?',
        [quantity, existing[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)',
        [req.user.id, product_id, quantity]
      );
    }

    res.status(201).json({ status: 'success', message: 'Товар додано до кошика' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/cart/:id — змінити кількість
router.patch('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity < 1) throw new AppError('Невірна кількість', 400);

    await pool.query(
      'UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?',
      [quantity, req.params.id, req.user.id]
    );

    res.json({ status: 'success', message: 'Кількість оновлено' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/cart/:id — видалити товар
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    await pool.query(
      'DELETE FROM cart_items WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    res.json({ status: 'success', message: 'Товар видалено з кошика' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;