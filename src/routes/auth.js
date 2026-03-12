const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const pool = require('../db');
const { AppError } = require('../middleware/errorHandler');

// Схеми валідації
const registerSchema = z.object({
  first_name: z.string().min(2, 'Імʼя мінімум 2 символи'),
  last_name:  z.string().min(2, 'Прізвище мінімум 2 символи'),
  email:      z.string().email('Невірний email'),
  phone:      z.string().min(10, 'Невірний номер телефону').optional(),
  password:   z.string().min(8, 'Пароль мінімум 8 символів'),
});

const loginSchema = z.object({
  email:    z.string().email('Невірний email'),
  password: z.string().min(1, 'Введіть пароль'),
});

// POST /auth/register
router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?', [data.email]
    );
    if (existing.length > 0) {
      throw new AppError('Користувач з таким email вже існує', 409);
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const [result] = await pool.query(
      'INSERT INTO users (first_name, last_name, email, phone, password) VALUES (?, ?, ?, ?, ?)',
      [data.first_name, data.last_name, data.email, data.phone || null, hashedPassword]
    );

    const token = jwt.sign(
      { id: result.insertId, email: data.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      status: 'success',
      message: 'Реєстрація успішна',
      token,
      user: {
        id:         result.insertId,
        first_name: data.first_name,
        last_name:  data.last_name,
        email:      data.email,
      },
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        status: 'error',
        message: err.errors[0].message,
      });
    }
    next(err);
  }
});

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?', [data.email]
    );
    if (users.length === 0) {
      throw new AppError('Невірний email або пароль', 401);
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(data.password, user.password);
    if (!validPassword) {
      throw new AppError('Невірний email або пароль', 401);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      status: 'success',
      message: 'Вхід успішний',
      token,
      user: {
      id:         user.id,
      first_name: user.first_name,
      last_name:  user.last_name,
      email:      user.email,
      phone:      user.phone,
  },
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        status: 'error',
        message: err.errors[0].message,
      });
    }
    next(err);
  }
});

module.exports = router;