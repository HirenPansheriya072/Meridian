const app = require('./src/app');
const env = require('./src/config/env');
const { connectDb } = require('./src/config/db');

// Connect to database on startup/cold start
connectDb().catch((err) => {
  console.error('Failed to connect to database', err);
});

if (require.main === module) {
  const server = app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
    if (!env.mail.host) console.log('SMTP not configured -- emails will be logged to console.');
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, closing server`);
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
