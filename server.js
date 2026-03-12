require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes     = require('./src/routes/auth');
const productsRoutes = require('./src/routes/products');
const cartRoutes     = require('./src/routes/cart');
const { errorHandler } = require('./src/middleware/errorHandler');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статичні файли (HTML, CSS, JS, images)
app.use(express.static(path.join(__dirname)));

// API роути
app.use('/api/auth',     authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/cart',     cartRoutes);

// Головна сторінка
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Сервер запущено: http://localhost:${PORT}`);
});

module.exports = app;