const crypto = require('crypto');

/**
 * RFC 5545 calendar file generation.
 *
 * Deliberately hand-rolled: the spec's fiddly parts are few and specific, and
 * getting them right is what makes the file actually import into Outlook rather
 * than silently fail. The three that bite people:
 *
 *   1. Lines fold at 75 octets, continuation lines start with a single space.
 *   2. CRLF endings, everywhere, not LF.
 *   3. Commas, semicolons and newlines inside text values must be escaped.
 *
 * Times go out as UTC with a Z suffix, which sidesteps having to ship VTIMEZONE
 * definitions -- the receiving client renders in the user's own zone anyway.
 */

function escapeText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function formatUtc(date) {
  return new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Fold to 75 octets, measuring bytes rather than characters so emoji survive. */
function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const parts = [];
  let offset = 0;
  let limit = 75;

  while (offset < bytes.length) {
    let take = Math.min(limit, bytes.length - offset);
    // Never split a multi-byte character down the middle.
    while (take > 0 && (bytes[offset + take] & 0xc0) === 0x80) take -= 1;
    parts.push(bytes.subarray(offset, offset + take).toString('utf8'));
    offset += take;
    limit = 74; // continuation lines lose one octet to the leading space
  }

  return parts.join('\r\n ');
}

function buildEvent({ booking, hosts, organizerEmail }) {
  const uid = `${booking._id || crypto.randomUUID()}@meridian.scheduling`;
  const cancelled = booking.status === 'cancelled';

  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(booking.startAt)}`,
    `DTEND:${formatUtc(booking.endAt)}`,
    `SUMMARY:${escapeText(booking.eventTitle)}`,
    `STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    // Bumping the sequence is what tells a calendar client this is an update to an
    // event it already has, rather than a new one.
    `SEQUENCE:${cancelled ? 1 : 0}`,
  ];

  const location = booking.location?.detail || booking.location?.type;
  if (location) lines.push(`LOCATION:${escapeText(location)}`);

  const description = [
    booking.attendee?.notes ? `Notes: ${booking.attendee.notes}` : null,
    booking.manageToken ? `Reschedule or cancel: ${booking.manageUrl || ''}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);

  if (organizerEmail) {
    lines.push(`ORGANIZER;CN=${escapeText(hosts[0]?.name || 'Host')}:mailto:${organizerEmail}`);
  }
  for (const host of hosts || []) {
    lines.push(`ATTENDEE;CN=${escapeText(host.name)};ROLE=REQ-PARTICIPANT:mailto:${host.email}`);
  }
  if (booking.attendee?.email) {
    lines.push(
      `ATTENDEE;CN=${escapeText(booking.attendee.name)};ROLE=REQ-PARTICIPANT:mailto:${booking.attendee.email}`
    );
  }

  lines.push('END:VEVENT');
  return lines;
}

function buildCalendar({ booking, hosts, organizerEmail }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Meridian//Scheduling//EN',
    'CALSCALE:GREGORIAN',
    booking.status === 'cancelled' ? 'METHOD:CANCEL' : 'METHOD:REQUEST',
    ...buildEvent({ booking, hosts, organizerEmail }),
    'END:VCALENDAR',
  ];

  return lines.map(fold).join('\r\n') + '\r\n';
}

module.exports = { buildCalendar, escapeText, formatUtc, fold };
