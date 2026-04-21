// middleware/errorMiddleware.js
const errorHandler = (err, req, res, next) => {
  console.error('🔥 Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? '🍰' : err.stack,
    path: req.path,
    method: req.method,
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

module.exports = errorHandler;
