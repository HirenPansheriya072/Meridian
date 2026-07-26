const { z } = require('zod');
const { isValidTimeZone } = require('../utils/tz');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Not a valid id');
const timezone = z.string().refine(isValidTimeZone, 'Not a recognised IANA timezone');
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const windowSchema = z
  .object({
    start: z.coerce.number().int().min(0).max(1440),
    end: z.coerce.number().int().min(0).max(1440),
  })
  .refine((w) => w.end > w.start, { message: 'A window has to end after it starts' });

const registerSchema = z.object({
  name: z.string().min(2, 'Use at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
  orgName: z.string().min(2, 'Name the business'),
  timezone,
});

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

const scheduleSchema = z.object({
  name: z.string().min(1).optional(),
  weekly: z.array(z.array(windowSchema)).length(7, 'A week has seven days'),
  overrides: z
    .array(
      z.object({
        date: dateKey,
        label: z.string().optional(),
        windows: z.array(windowSchema),
      })
    )
    .optional(),
});

const eventTypeSchema = z.object({
  title: z.string().min(2, 'Give it a name'),
  description: z.string().optional(),
  color: z.string().optional(),
  active: z.boolean().optional(),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  slotIncrementMinutes: z.coerce.number().int().min(5).max(120).optional(),
  bufferBeforeMinutes: z.coerce.number().int().min(0).max(120).optional(),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(120).optional(),
  minimumNoticeMinutes: z.coerce.number().int().min(0).optional(),
  maximumAdvanceDays: z.coerce.number().int().min(1).max(730).optional(),
  maxBookingsPerDay: z.coerce.number().int().min(0).optional(),
  assignment: z.enum(['single', 'collective', 'roundRobin']).optional(),
  hostIds: z.array(objectId).min(1, 'Pick at least one host'),
  location: z
    .object({
      type: z.enum(['video', 'phone', 'inPerson', 'custom']),
      detail: z.string().optional(),
    })
    .optional(),
  questions: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        type: z.enum(['text', 'textarea', 'select', 'phone']).optional(),
        options: z.array(z.string()).optional(),
        required: z.boolean().optional(),
      })
    )
    .optional(),
  requiresConfirmation: z.boolean().optional(),
});

const availabilityQuerySchema = z.object({
  from: dateKey,
  to: dateKey,
  timezone,
});

const createBookingSchema = z.object({
  startAt: z.string().datetime({ message: 'Send an ISO instant' }),
  timezone,
  name: z.string().min(1, 'Tell us your name'),
  email: z.string().email('Enter a valid email'),
  notes: z.string().max(2000).optional(),
  answers: z.record(z.string()).optional(),
});

const rescheduleSchema = z.object({
  startAt: z.string().datetime({ message: 'Send an ISO instant' }),
  timezone,
});

const cancelSchema = z.object({
  reason: z.string().max(500).optional(),
});

const profileSchema = z.object({
  name: z.string().min(2).optional(),
  title: z.string().max(80).optional(),
  timezone: timezone.optional(),
  avatarUrl: z.string().max(1000).optional(),
  bio: z.string().max(2000).optional(),
  socialLinks: z.object({
    website: z.string().max(500).optional(),
    linkedin: z.string().max(500).optional(),
    twitter: z.string().max(500).optional(),
    instagram: z.string().max(500).optional(),
  }).optional(),
});

const orgUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  brandColor: z.string().max(30).optional(),
  logoUrl: z.string().max(1000).optional(),
});

const idParams = z.object({ id: objectId });

module.exports = {
  registerSchema,
  loginSchema,
  scheduleSchema,
  eventTypeSchema,
  availabilityQuerySchema,
  createBookingSchema,
  rescheduleSchema,
  cancelSchema,
  profileSchema,
  orgUpdateSchema,
  idParams,
};
