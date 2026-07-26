const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

app.set('trust proxy', 1);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: env.clientOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
if (!env.isProd) app.use(morgan('dev'));

const mongoose = require('mongoose');
const { connectDb } = require('./config/db');

// Ensure database connection is active on every serverless request
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDb();
    } catch (err) {
      console.error('Database connection error inside middleware:', err);
      return next(err);
    }
  }
  next();
});

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;

