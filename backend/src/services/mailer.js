const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const env = require('../config/env');
const tz = require('../utils/tz');

let transporter = null;
function getTransporter() {
  if (!env.mail.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.port === 465,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
    });
  }
  return transporter;
}

let resendInstance = null;
function getResend() {
  if (!env.resendApiKey) return null;
  if (!resendInstance) {
    resendInstance = new Resend(env.resendApiKey);
  }
  return resendInstance;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Same instant, spelled out in one person's zone. */
function describeIn(instant, timezone) {
  const z = tz.utcToZoned(instant, timezone);
  const hour12 = z.hour % 12 === 0 ? 12 : z.hour % 12;
  const suffix = z.hour < 12 ? 'am' : 'pm';
  return `${WEEKDAYS[z.weekday]} ${z.day} ${MONTHS[z.month - 1]}, ${hour12}:${String(z.minute).padStart(2, '0')}${suffix} (${timezone.replace(/_/g, ' ')})`;
}

/** Generate a premium, responsive HTML email matching Meridian's styling guidelines. */
function buildHtmlEmail({ title, bodyParagraphs, ctaLabel, ctaUrl, metadataFields }) {
  const metadataRows = metadataFields && metadataFields.length
    ? metadataFields.map(field => `
        <tr>
          <td style="padding: 6px 0; font-family: monospace; font-size: 12px; color: #8A909E; width: 100px; vertical-align: top;">${field.label}</td>
          <td style="padding: 6px 0; font-family: monospace; font-size: 12px; color: #1C1F26; font-weight: 500;">${field.value}</td>
        </tr>
      `).join('')
    : '';

  const paragraphsHtml = bodyParagraphs.map(p => `
    <p style="margin: 0 0 16px 0; font-family: 'Instrument Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; line-height: 1.6; color: #2C2C2C;">
      ${p}
    </p>
  `).join('');

  const ctaHtml = ctaUrl
    ? `
      <div style="margin: 24px 0; text-align: center;">
        <a href="${ctaUrl}" style="display: inline-block; padding: 12px 24px; font-family: 'Instrument Sans', -apple-system, sans-serif; font-size: 13px; font-weight: 600; color: #FFFFFF; background-color: #2B3A67; text-decoration: none; border-radius: 6px;">
          ${ctaLabel || 'View Details'}
        </a>
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F7F4; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F7F4; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="500" border="0" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: #FFFFFF; border: 1px solid #E0DFD9; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 24px 16px 24px; border-bottom: 1px solid #E0DFD9; background-color: #FFFFFF;">
              <span style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #8A909E; display: block; font-weight: 600;">Meridian</span>
              <h1 style="margin: 4px 0 0 0; font-family: 'Instrument Serif', Georgia, serif; font-size: 24px; font-weight: normal; color: #1C1F26; line-height: 1.2;">${title}</h1>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 24px 24px 16px 24px;">
              ${paragraphsHtml}
              ${ctaHtml}
            </td>
          </tr>
          <!-- Metadata block -->
          ${metadataRows ? `
          <tr>
            <td style="padding: 0 24px 24px 24px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top: 1px solid #E0DFD9; padding-top: 16px;">
                ${metadataRows}
              </table>
            </td>
          </tr>
          ` : ''}
          <!-- Footer -->
          <tr>
            <td style="padding: 16px 24px; background-color: #FBFBFA; border-top: 1px solid #E0DFD9; text-align: center;">
              <p style="margin: 0; font-family: monospace; font-size: 10px; color: #8A909E;">
                Scheduling across timezones, properly.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Dispatch email. Uses Resend API if credentials are provided, falling back to
 * Nodemailer SMTP or simple console logging.
 */
async function send({ to, subject, text, html, icsContent, icsFilename }) {
  const resend = getResend();
  if (resend) {
    try {
      const payload = {
        from: env.mail.from || 'Meridian <onboarding@resend.dev>',
        to,
        subject,
        text,
        html: html || undefined,
        attachments: icsContent
          ? [
              {
                filename: icsFilename || 'invite.ics',
                content: Buffer.from(icsContent),
              },
            ]
          : undefined,
      };
      await resend.emails.send(payload);
      console.log(`[resend] email sent to ${to}: ${subject}`);
      return;
    } catch (err) {
      console.error('[resend] failed to send email, falling back to SMTP...', err.message);
    }
  }

  const mailer = getTransporter();
  if (!mailer) {
    console.log(`[mail] (console log fallback) would send to ${to}: ${subject}`);
    return;
  }
  await mailer.sendMail({
    from: env.mail.from,
    to,
    subject,
    text,
    html: html || undefined,
    attachments: icsContent
      ? [{ filename: icsFilename || 'invite.ics', content: icsContent, contentType: 'text/calendar; method=REQUEST' }]
      : undefined,
  });
}

async function sendBookingConfirmation({ booking, hosts, icsContent, manageUrl }) {
  const attendeeTime = describeIn(booking.startAt, booking.bookerTimezone);
  const hostTime = describeIn(booking.startAt, booking.hostTimezone);

  const text = `Your booking is confirmed.

${booking.eventTitle}
${attendeeTime}
${hostTime} for ${hosts.map((h) => h.name).join(', ')}

Need to change it? ${manageUrl}`;

  const html = buildHtmlEmail({
    title: 'Booking Confirmed',
    bodyParagraphs: [
      `Your meeting for <strong>${booking.eventTitle}</strong> has been successfully booked.`,
      `A calendar invitation is attached to this email. You can reschedule or cancel this meeting at any time using the link below.`
    ],
    ctaLabel: 'Manage Booking',
    ctaUrl: manageUrl,
    metadataFields: [
      { label: 'Event', value: booking.eventTitle },
      { label: 'Your Time', value: attendeeTime },
      { label: 'Host Time', value: hostTime },
      { label: 'Host(s)', value: hosts.map((h) => h.name).join(', ') }
    ]
  });

  await send({
    to: booking.attendee.email,
    subject: `Confirmed: ${booking.eventTitle}`,
    text,
    html,
    icsContent,
    icsFilename: 'booking.ics',
  });

  for (const host of hosts) {
    const hostText = `${booking.attendee.name} (${booking.attendee.email}) booked ${booking.eventTitle}.

${describeIn(booking.startAt, host.timezone)}
Their time: ${attendeeTime}

${booking.attendee.notes ? `Notes: ${booking.attendee.notes}` : ''}`;

    const hostHtml = buildHtmlEmail({
      title: 'New Booking Received',
      bodyParagraphs: [
        `<strong>${booking.attendee.name}</strong> (${booking.attendee.email}) has booked a slot for <strong>${booking.eventTitle}</strong>.`,
        booking.attendee.notes ? `<strong>Attendee Notes</strong>: "${booking.attendee.notes}"` : ''
      ].filter(Boolean),
      ctaLabel: 'View Calendar',
      ctaUrl: manageUrl,
      metadataFields: [
        { label: 'Event', value: booking.eventTitle },
        { label: 'Your Time', value: describeIn(booking.startAt, host.timezone) },
        { label: 'Their Time', value: attendeeTime },
        { label: 'Attendee', value: `${booking.attendee.name} (${booking.attendee.email})` }
      ]
    });

    await send({
      to: host.email,
      subject: `New booking: ${booking.eventTitle} with ${booking.attendee.name}`,
      text: hostText,
      html: hostHtml,
      icsContent,
      icsFilename: 'booking.ics',
    });
  }
}

async function sendCancellation({ booking, hosts, reason, cancelledBy }) {
  const who = cancelledBy === 'host' ? 'The host' : booking.attendee.name;
  const attendeeTime = describeIn(booking.startAt, booking.bookerTimezone);

  const text = `${who} cancelled this booking.

${booking.eventTitle}
${attendeeTime}
${reason ? `\nReason: ${reason}` : ''}`;

  const html = buildHtmlEmail({
    title: 'Booking Cancelled',
    bodyParagraphs: [
      `The booking for <strong>${booking.eventTitle}</strong> has been cancelled by <strong>${who === 'The host' ? 'the host' : who}</strong>.`,
      reason ? `<strong>Reason for cancellation</strong>: "${reason}"` : ''
    ].filter(Boolean),
    metadataFields: [
      { label: 'Event', value: booking.eventTitle },
      { label: 'Time (Scheduled)', value: attendeeTime },
      { label: 'Status', value: 'CANCELLED' }
    ]
  });

  await send({
    to: booking.attendee.email,
    subject: `Cancelled: ${booking.eventTitle}`,
    text,
    html,
  });

  for (const host of hosts) {
    const hostText = `${who} cancelled.

${describeIn(booking.startAt, host.timezone)}
${reason ? `\nReason: ${reason}` : ''}`;

    const hostHtml = buildHtmlEmail({
      title: 'Booking Cancelled',
      bodyParagraphs: [
        `The booking for <strong>${booking.eventTitle}</strong> has been cancelled by <strong>${who === 'The host' ? 'you (the host)' : who}</strong>.`,
        reason ? `<strong>Reason for cancellation</strong>: "${reason}"` : ''
      ].filter(Boolean),
      metadataFields: [
        { label: 'Event', value: booking.eventTitle },
        { label: 'Your Time', value: describeIn(booking.startAt, host.timezone) },
        { label: 'Attendee', value: `${booking.attendee.name} (${booking.attendee.email})` }
      ]
    });

    await send({
      to: host.email,
      subject: `Cancelled: ${booking.eventTitle} with ${booking.attendee.name}`,
      text: hostText,
      html: hostHtml,
    });
  }
}

module.exports = { send, sendBookingConfirmation, sendCancellation, describeIn };
