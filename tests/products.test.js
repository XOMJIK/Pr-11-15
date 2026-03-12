const pool = require('../src/db');

afterAll(async () => {
  await pool.end();
});

describe('Products API', () => {

  test('отримати всі товари', async () => {
    const [rows] = await pool.query('SELECT * FROM products');
    expect(rows.length).toBeGreaterThan(0);
  });

  test('товари мають потрібні поля', async () => {
    const [rows] = await pool.query('SELECT * FROM products LIMIT 1');
    const product = rows[0];
    expect(product).toHaveProperty('id');
    expect(product).toHaveProperty('name');
    expect(product).toHaveProperty('price');
    expect(product).toHaveProperty('category_id');
    expect(product).toHaveProperty('brand_id');
  });

  test('фільтр по категорії працює', async () => {
    const [rows] = await pool.query(
      'SELECT * FROM products WHERE category_id = 1'
    );
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach(p => expect(p.category_id).toBe(1));
  });

  test('пошук по назві працює', async () => {
    const [rows] = await pool.query(
      "SELECT * FROM products WHERE name LIKE '%Razer%'"
    );
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach(p => expect(p.name).toMatch(/Razer/i));
  });

  test('товар не знайдено — порожній масив', async () => {
    const [rows] = await pool.query(
      'SELECT * FROM products WHERE id = 99999'
    );
    expect(rows.length).toBe(0);
  });

});

describe('Categories API', () => {

  test('отримати всі категорії', async () => {
    const [rows] = await pool.query('SELECT * FROM categories');
    expect(rows.length).toBe(5);
  });

  test('категорії мають slug', async () => {
    const [rows] = await pool.query('SELECT * FROM categories');
    rows.forEach(c => {
      expect(c).toHaveProperty('slug');
      expect(c.slug.length).toBeGreaterThan(0);
    });
  });

});

describe('Users API', () => {

  test('створити користувача', async () => {
    await pool.query(
      'INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)',
      ['Тест', 'Юзер', 'test@test.com', 'hashedpassword123']
    );
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ?', ['test@test.com']
    );
    expect(rows.length).toBe(1);
    expect(rows[0].first_name).toBe('Тест');
  });

  test('email унікальний — дублікат викидає помилку', async () => {
    await expect(
      pool.query(
        'INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)',
        ['Тест2', 'Юзер2', 'test@test.com', 'pass']
      )
    ).rejects.toThrow();
  });

  test('видалити тестового користувача', async () => {
    await pool.query('DELETE FROM users WHERE email = ?', ['test@test.com']);
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ?', ['test@test.com']
    );
    expect(rows.length).toBe(0);
  });

});