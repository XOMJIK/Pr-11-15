const express = require('express');
const router = express.Router();
const pool = require('../db');
const { AppError } = require('../middleware/errorHandler');

router.get('/', async (req, res, next) => {
  try {
    const { category, brand, search, sort, min_price, max_price } = req.query;

    let query = `
      SELECT p.*, c.name as category_name, b.name as brand_name
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN brands b ON p.brand_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      query += ' AND c.slug = ?';
      params.push(category);
    }
    if (brand) {
      query += ' AND b.name = ?';
      params.push(brand);
    }
    if (search) {
      query += ' AND p.name LIKE ?';
      params.push(`%${search}%`);
    }
    if (min_price) {
      query += ' AND p.price >= ?';
      params.push(min_price);
    }
    if (max_price) {
      query += ' AND p.price <= ?';
      params.push(max_price);
    }

    if (sort === 'price-asc')  query += ' ORDER BY p.price ASC';
    else if (sort === 'price-desc') query += ' ORDER BY p.price DESC';
    else if (sort === 'rating')     query += ' ORDER BY p.rating DESC';
    else query += ' ORDER BY p.id DESC';

    const [products] = await pool.query(query, params);

    res.json({
      status: 'success',
      data: products,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/new', async (req, res, next) => {
  try {
    const [products] = await pool.query(`
      SELECT p.*, c.name as category_name, b.name as brand_name
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN brands b ON p.brand_id = b.id
      WHERE p.is_new = 1
      ORDER BY p.id DESC
    `);
    res.json({ status: 'success', data: products });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [products] = await pool.query(`
      SELECT p.*, c.name as category_name, b.name as brand_name
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN brands b ON p.brand_id = b.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (products.length === 0) {
      throw new AppError('Товар не знайдено', 404);
    }

    res.json({ status: 'success', data: products[0] });
  } catch (err) {
    next(err);
  }
});

router.get('/category/:slug', async (req, res, next) => {
  try {
    const [products] = await pool.query(`
      SELECT p.*, c.name as category_name, b.name as brand_name
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN brands b ON p.brand_id = b.id
      WHERE c.slug = ?
      ORDER BY p.id DESC
    `, [req.params.slug]);

    res.json({ status: 'success', data: products });
  } catch (err) {
    next(err);
  }
});

module.exports = router;