const errorHandler = (err, req, res, next) => {
  console.error(err.message);

  const status = err.statusCode || 500;
  const message = err.message || 'Внутрішня помилка сервера';

  res.status(status).json({
    status: 'error',
    message,
  });
};

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = { errorHandler, AppError };