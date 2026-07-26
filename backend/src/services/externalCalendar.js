const env = require('../config/env');
const User = require('../models/User');

/** Check and refresh Google OAuth token if expired or expiring in the next 5 minutes. */
async function refreshGoogleToken(userId, googleCalendar) {
  if (!googleCalendar.refreshToken) return null;

  const now = new Date();
  const buffer = 5 * 60 * 1000; // 5 minute buffer
  if (googleCalendar.expiryDate && new Date(googleCalendar.expiryDate).getTime() - now.getTime() > buffer) {
    return googleCalendar.accessToken;
  }

  console.log(`[google-calendar] Refreshing access token for user: ${userId}`);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      refresh_token: googleCalendar.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[google-calendar] Failed to refresh token: ${errorText}`);
    return null;
  }

  const data = await response.json();
  const expiryDate = new Date(Date.now() + data.expires_in * 1000);

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        'googleCalendar.accessToken': data.access_token,
        'googleCalendar.expiryDate': expiryDate,
      },
    }
  );

  return data.access_token;
}

/** Check and refresh Outlook OAuth token if expired or expiring in the next 5 minutes. */
async function refreshOutlookToken(userId, outlookCalendar) {
  if (!outlookCalendar.refreshToken) return null;

  const now = new Date();
  const buffer = 5 * 60 * 1000; // 5 minute buffer
  if (outlookCalendar.expiryDate && new Date(outlookCalendar.expiryDate).getTime() - now.getTime() > buffer) {
    return outlookCalendar.accessToken;
  }

  console.log(`[outlook-calendar] Refreshing access token for user: ${userId}`);
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.outlook.clientId,
      client_secret: env.outlook.clientSecret,
      refresh_token: outlookCalendar.refreshToken,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/Calendars.Read offline_access',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[outlook-calendar] Failed to refresh token: ${errorText}`);
    return null;
  }

  const data = await response.json();
  const expiryDate = new Date(Date.now() + data.expires_in * 1000);

  const updates = {
    'outlookCalendar.accessToken': data.access_token,
    'outlookCalendar.expiryDate': expiryDate,
  };
  if (data.refresh_token) {
    updates['outlookCalendar.refreshToken'] = data.refresh_token;
  }

  await User.updateOne({ _id: userId }, { $set: updates });
  return data.access_token;
}

/** Fetch busy intervals from Google Calendar primary calendar. */
async function getGoogleBusy(userId, googleCalendar, start, end) {
  const token = await refreshGoogleToken(userId, googleCalendar);
  if (!token) return [];

  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: 'primary' }],
      }),
    });

    if (!response.ok) {
      console.error(`[google-calendar] FreeBusy query failed: ${await response.text()}`);
      return [];
    }

    const data = await response.json();
    const busy = data.calendars?.primary?.busy || [];
    return busy.map((event) => ({
      start: new Date(event.start).getTime(),
      end: new Date(event.end).getTime(),
    }));
  } catch (err) {
    console.error(`[google-calendar] Error scanning freebusy:`, err.message);
    return [];
  }
}

/** Fetch busy intervals from Outlook via MS Graph API. */
async function getOutlookBusy(userId, outlookCalendar, start, end) {
  const token = await refreshOutlookToken(userId, outlookCalendar);
  if (!token) return [];

  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/calendar/getSchedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Prefer: 'outlook.timezone="UTC"',
      },
      body: JSON.stringify({
        schedules: [outlookCalendar.email || 'me'],
        startTime: {
          dateTime: start.toISOString(),
          timeZone: 'UTC',
        },
        endTime: {
          dateTime: end.toISOString(),
          timeZone: 'UTC',
        },
        availabilityViewInterval: 15,
      }),
    });

    if (!response.ok) {
      console.error(`[outlook-calendar] getSchedule query failed: ${await response.text()}`);
      return [];
    }

    const data = await response.json();
    const schedule = data.value?.[0]?.scheduleItems || [];
    return schedule
      .filter((item) => item.status !== 'free')
      .map((item) => ({
        start: new Date(item.start.dateTime + 'Z').getTime(),
        end: new Date(item.end.dateTime + 'Z').getTime(),
      }));
  } catch (err) {
    console.error(`[outlook-calendar] Error scanning getSchedule:`, err.message);
    return [];
  }
}

/** Main external calendar sync engine. Gathers all external busy times. */
async function getExternalBusyIntervals(user, start, end) {
  const tasks = [];

  if (user.googleCalendar && user.googleCalendar.connected) {
    tasks.push(getGoogleBusy(user._id, user.googleCalendar, start, end));
  }

  if (user.outlookCalendar && user.outlookCalendar.connected) {
    tasks.push(getOutlookBusy(user._id, user.outlookCalendar, start, end));
  }

  const results = await Promise.all(tasks);
  return results.flat();
}

module.exports = {
  getExternalBusyIntervals,
  refreshGoogleToken,
  refreshOutlookToken,
};