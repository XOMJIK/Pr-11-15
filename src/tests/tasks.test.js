const request = require('supertest');
const app     = require('../../server');
const db      = require('../db');

let token  = '';
let userId = 0;
let taskId = 0;

beforeAll(async () => {
  const email = `test_tasks_${Date.now()}@test.com`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ first_name: 'Test', last_name: 'User', email, phone: '0991234567', password: 'password123' });

  token  = res.body.token;
  userId = res.body.user?.id;
});

afterAll(async () => {
  if (userId) await db.query('DELETE FROM users WHERE id = ?', [userId]);
  await db.end?.();
});

test('POST /api/tasks — створює задачу зі статусом 201', async () => {
  const res = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Тестова задача', description: 'Опис', priority: 3 });

  expect(res.statusCode).toBe(201);
  expect(res.body.success).toBe(true);
  expect(res.body.data).toHaveProperty('id');
  expect(res.body.data.title).toBe('Тестова задача');
  taskId = res.body.data.id;
});

test('POST /api/tasks — 400 при порожньому title', async () => {
  const res = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: '' });

  expect(res.statusCode).toBe(400);
});

test('GET /api/tasks — повертає список із pagination', async () => {
  const res = await request(app)
    .get('/api/tasks')
    .set('Authorization', `Bearer ${token}`);

  expect(res.statusCode).toBe(200);
  expect(Array.isArray(res.body.data)).toBe(true);
  expect(res.body.pagination).toHaveProperty('total');
});

test('GET /api/tasks?status=open — фільтрує за статусом', async () => {
  const res = await request(app)
    .get('/api/tasks?status=open')
    .set('Authorization', `Bearer ${token}`);

  expect(res.statusCode).toBe(200);
  res.body.data.forEach(t => expect(t.status).toBe('open'));
});

test('GET /api/tasks?priority=3 — фільтрує за пріоритетом', async () => {
  const res = await request(app)
    .get('/api/tasks?priority=3')
    .set('Authorization', `Bearer ${token}`);

  expect(res.statusCode).toBe(200);
  res.body.data.forEach(t => expect(t.priority).toBe(3));
});

test('GET /api/tasks?search=Тестова — знаходить задачу', async () => {
  const res = await request(app)
    .get('/api/tasks?search=Тестова')
    .set('Authorization', `Bearer ${token}`);

  expect(res.statusCode).toBe(200);
  expect(res.body.data.length).toBeGreaterThan(0);
});

test('GET /api/tasks/:id — повертає задачу за ID', async () => {
  const res = await request(app)
    .get(`/api/tasks/${taskId}`)
    .set('Authorization', `Bearer ${token}`);

  expect(res.statusCode).toBe(200);
  expect(res.body.data.id).toBe(taskId);
});

test('GET /api/tasks/999999 — повертає 404', async () => {
  const res = await request(app)
    .get('/api/tasks/999999')
    .set('Authorization', `Bearer ${token}`);

  expect(res.statusCode).toBe(404);
});

test('PATCH /api/tasks/:id — оновлює статус на done', async () => {
  const res = await request(app)
    .patch(`/api/tasks/${taskId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'done' });

  expect(res.statusCode).toBe(200);
  expect(res.body.data.status).toBe('done');
});

test('POST /api/tasks/:id/attachments — завантажує файл', async () => {
  const res = await request(app)
    .post(`/api/tasks/${taskId}/attachments`)
    .set('Authorization', `Bearer ${token}`)
    .attach('files', Buffer.from('test content'), 'test.png');

  expect(res.statusCode).toBe(201);
  expect(res.body.success).toBe(true);
  expect(Array.isArray(res.body.data)).toBe(true);
});

test('GET /api/tasks/:id/attachments — повертає список файлів', async () => {
  const res = await request(app)
    .get(`/api/tasks/${taskId}/attachments`)
    .set('Authorization', `Bearer ${token}`);

  expect(res.statusCode).toBe(200);
  expect(res.body.data.length).toBeGreaterThan(0);
});

test('DELETE /api/tasks/:id — видаляє задачу', async () => {
  const res = await request(app)
    .delete(`/api/tasks/${taskId}`)
    .set('Authorization', `Bearer ${token}`);

  expect(res.statusCode).toBe(200);
  expect(res.body.success).toBe(true);
});