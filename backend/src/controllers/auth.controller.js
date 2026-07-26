const User = require('../models/User');
const Org = require('../models/Org');
const Schedule = require('../models/Schedule');
const EventType = require('../models/EventType');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken, setAuthCookie, clearAuthCookie } = require('../utils/token');

function slugify(text) {
  return String(text).toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

async function uniqueOrgSlug(base) {
  let slug = slugify(base) || 'team';
  let n = 2;
  while (await Org.findOne({ slug }).lean()) {
    slug = `${slugify(base)}-${n}`;
    n += 1;
  }
  return slug;
}

/**
 * Signing up gives you a working calendar immediately: an org, a 9-to-5 schedule in
 * your own zone, and one bookable event type. An empty scheduling app is useless,
 * and asking someone to configure three things before seeing anything is worse.
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, orgName, timezone } = req.body;
  if (await User.findOne({ email })) throw ApiError.conflict('That email is already registered');

  const org = await Org.create({ name: orgName, slug: await uniqueOrgSlug(orgName), timezone });
  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ orgId: org._id, name, email, passwordHash, role: 'owner', timezone });

  await Schedule.create({
    orgId: org._id,
    userId: user._id,
    name: 'Working hours',
    isDefault: true,
    weekly: Schedule.nineToFive(),
  });

  await EventType.create({
    orgId: org._id,
    title: '30 minute meeting',
    slug: '30-minute-meeting',
    description: 'A half hour to talk things through.',
    durationMinutes: 30,
    hostIds: [user._id],
    location: { type: 'video', detail: '' },
  });

  setAuthCookie(res, signToken(user));
  res.status(201).json({ user: user.toPublic() });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await user.checkPassword(password))) {
    throw ApiError.unauthorized('Email or password is incorrect');
  }
  setAuthCookie(res, signToken(user));
  res.json({ user: user.toPublic() });
});

const demoLogin = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: env.demo.email });
  if (!user) throw ApiError.notFound('The demo account is not seeded yet. Run npm run seed.');
  setAuthCookie(res, signToken(user));
  res.json({ user: user.toPublic() });
});

const logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

const me = asyncHandler(async (req, res) => {
  const org = await Org.findById(req.orgId).lean();
  res.json({
    user: req.user.toPublic(),
    org: org && {
      id: String(org._id),
      name: org.name,
      slug: org.slug,
      timezone: org.timezone,
      brandColor: org.brandColor,
      logoUrl: org.logoUrl,
    },
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user._id, { $set: req.body }, { new: true });
  res.json({ user: user.toPublic() });
});

const updateOrg = asyncHandler(async (req, res) => {
  const { name, brandColor, logoUrl } = req.body;
  const org = await Org.findByIdAndUpdate(
    req.orgId,
    { $set: { name, brandColor, logoUrl } },
    { new: true }
  );
  res.json({
    org: org && {
      id: String(org._id),
      name: org.name,
      slug: org.slug,
      timezone: org.timezone,
      brandColor: org.brandColor,
      logoUrl: org.logoUrl,
    },
  });
});

const listTeam = asyncHandler(async (req, res) => {
  const users = await User.find({ orgId: req.orgId }).sort({ createdAt: 1 }).lean();
  res.json({
    items: users.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      timezone: u.timezone,
      avatarColor: u.avatarColor,
      title: u.title,
    })),
  });
});

module.exports = { register, login, demoLogin, logout, me, updateProfile, updateOrg, listTeam };
