require('dotenv').config();

for (const key of ['MONGODB_URI', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}. Copy .env.example to .env first.`);
    process.exit(1);
  }
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  resendApiKey: process.env.RESEND_API_KEY,
  cookie: {
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    secure: String(process.env.COOKIE_SECURE) === 'true',
  },
  mail: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'Meridian <no-reply@meridian.scheduling>',
  },
  demo: {
    email: process.env.DEMO_EMAIL || 'demo@meridian.scheduling',
    password: process.env.DEMO_PASSWORD || 'demo1234',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/auth/google/callback',
  },
  outlook: {
    clientId: process.env.OUTLOOK_CLIENT_ID,
    clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
    redirectUri: process.env.OUTLOOK_REDIRECT_URI || 'http://localhost:4000/api/auth/outlook/callback',
  },
};
