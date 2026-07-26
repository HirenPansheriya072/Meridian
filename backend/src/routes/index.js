const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const auth = require('../controllers/auth.controller');
const booking = require('../controllers/booking.controller');
const calendar = require('../controllers/calendar.controller');
const dashboard = require('../controllers/dashboard.controller');
const s = require('../validators/schemas');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
// The public booking endpoints are open to the internet; keep them metered.
const publicLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
const bookLimiter = rateLimit({ windowMs: 60 * 1000, max: 8 });

router.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

router.get('/debug-env', (req, res) => {
  const uri = process.env.MONGODB_URI || '';
  const maskedUri = uri.replace(/:([^@]+)@/, ':****@');
  res.json({
    hasUri: !!uri,
    maskedUri,
    nodeEnv: process.env.NODE_ENV,
    clientOrigin: process.env.CLIENT_ORIGIN,
    dbStatus: require('mongoose').connection.readyState,
  });
});

/* auth */
router.post('/auth/register', authLimiter, validate({ body: s.registerSchema }), auth.register);
router.post('/auth/login', authLimiter, validate({ body: s.loginSchema }), auth.login);
router.post('/auth/demo', authLimiter, auth.demoLogin);
router.post('/auth/logout', auth.logout);
router.get('/auth/me', requireAuth, auth.me);
router.patch('/auth/profile', requireAuth, validate({ body: s.profileSchema }), auth.updateProfile);
router.patch('/auth/org', requireAuth, validate({ body: s.orgUpdateSchema }), auth.updateOrg);
router.get('/team', requireAuth, auth.listTeam);

/* external calendar OAuth connections */
router.get('/auth/google', requireAuth, calendar.connectGoogle);
router.get('/auth/google/callback', calendar.googleCallback);
router.post('/auth/google/disconnect', requireAuth, calendar.disconnectGoogle);

router.get('/auth/outlook', requireAuth, calendar.connectOutlook);
router.get('/auth/outlook/callback', calendar.outlookCallback);
router.post('/auth/outlook/disconnect', requireAuth, calendar.disconnectOutlook);

/* public booking flow -- no session required */
router.get('/public/:orgSlug/:eventSlug', publicLimiter, booking.getPublicEventType);
router.get(
  '/public/:orgSlug/:eventSlug/availability',
  publicLimiter,
  validate({ query: s.availabilityQuerySchema }),
  booking.getAvailability
);
router.post(
  '/public/:orgSlug/:eventSlug/book',
  bookLimiter,
  validate({ body: s.createBookingSchema }),
  booking.createBooking
);

/* managing a booking by token -- also no session */
router.get('/booking/:token', publicLimiter, booking.getByToken);
router.get('/booking/:token/ics', publicLimiter, booking.downloadIcs);
router.post('/booking/:token/cancel', bookLimiter, validate({ body: s.cancelSchema }), booking.cancelByToken);
router.post(
  '/booking/:token/reschedule',
  bookLimiter,
  validate({ body: s.rescheduleSchema }),
  booking.rescheduleByToken
);

/* dashboard */
router.get('/event-types', requireAuth, dashboard.listEventTypes);
router.post('/event-types', requireAuth, validate({ body: s.eventTypeSchema }), dashboard.createEventType);
router.get('/event-types/:id', requireAuth, validate({ params: s.idParams }), dashboard.getEventType);
router.patch(
  '/event-types/:id',
  requireAuth,
  validate({ params: s.idParams, body: s.eventTypeSchema.partial() }),
  dashboard.updateEventType
);
router.delete('/event-types/:id', requireAuth, validate({ params: s.idParams }), dashboard.deleteEventType);

router.get('/schedule', requireAuth, dashboard.getSchedule);
router.put('/schedule', requireAuth, validate({ body: s.scheduleSchema }), dashboard.updateSchedule);

router.get('/bookings', requireAuth, dashboard.listBookings);
router.post(
  '/bookings/:id/cancel',
  requireAuth,
  validate({ params: s.idParams, body: s.cancelSchema }),
  dashboard.cancelBooking
);

router.get('/summary', requireAuth, dashboard.summary);

module.exports = router;
