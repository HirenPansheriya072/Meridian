const env = require('../config/env');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const getFrontendUrl = () => env.clientOrigin.split(',')[0].trim();

/* ---------- Google Calendar Connect ---------- */

const connectGoogle = asyncHandler(async (req, res) => {
  const userId = String(req.user._id);

  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: env.google.redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email openid',
    access_type: 'offline',
    prompt: 'consent',
    state: userId,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

const googleCallback = asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  const frontendUrl = getFrontendUrl();

  if (!code) {
    return res.redirect(`${frontendUrl}/availability?error=Google connection cancelled`);
  }

  // State maps to userId
  const userId = state || (req.user && String(req.user._id));
  if (!userId) {
    throw ApiError.unauthorized('No host session found');
  }

  // 1. Exchange authorization code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      code,
      redirect_uri: env.google.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error(`[google-callback] Token exchange failed: ${errorText}`);
    return res.redirect(`${frontendUrl}/availability?error=Google authentication failed`);
  }

  const tokenData = await tokenResponse.json();

  // 2. Fetch user email from Google API
  const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  let email = '';
  if (userinfoResponse.ok) {
    const userinfo = await userinfoResponse.json();
    email = userinfo.email;
  }

  // 3. Save connection details in User profile
  const expiryDate = new Date(Date.now() + tokenData.expires_in * 1000);
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        googleCalendar: {
          connected: true,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiryDate,
          email,
        },
      },
    }
  );

  res.redirect(`${frontendUrl}/availability?success=Google Calendar Connected`);
});

const disconnectGoogle = asyncHandler(async (req, res) => {
  await User.updateOne(
    { _id: req.user._id },
    {
      $set: {
        'googleCalendar.connected': false,
        'googleCalendar.accessToken': null,
        'googleCalendar.refreshToken': null,
        'googleCalendar.expiryDate': null,
        'googleCalendar.email': null,
      },
    }
  );
  res.json({ ok: true });
});

/* ---------- Outlook Calendar Connect ---------- */

const connectOutlook = asyncHandler(async (req, res) => {
  const userId = String(req.user._id);

  const params = new URLSearchParams({
    client_id: env.outlook.clientId,
    redirect_uri: env.outlook.redirectUri,
    response_type: 'code',
    scope: 'https://graph.microsoft.com/Calendars.Read offline_access openid email',
    prompt: 'consent',
    state: userId,
  });

  res.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`);
});

const outlookCallback = asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  const frontendUrl = getFrontendUrl();

  if (!code) {
    return res.redirect(`${frontendUrl}/availability?error=Outlook connection cancelled`);
  }

  const userId = state || (req.user && String(req.user._id));
  if (!userId) {
    throw ApiError.unauthorized('No host session found');
  }

  // 1. Exchange authorization code for tokens
  const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.outlook.clientId,
      client_secret: env.outlook.clientSecret,
      code,
      redirect_uri: env.outlook.redirectUri,
      grant_type: 'authorization_code',
      scope: 'https://graph.microsoft.com/Calendars.Read offline_access',
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error(`[outlook-callback] Token exchange failed: ${errorText}`);
    return res.redirect(`${frontendUrl}/availability?error=Outlook authentication failed`);
  }

  const tokenData = await tokenResponse.json();

  // 2. Fetch user profile from MS Graph
  const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  let email = '';
  if (profileResponse.ok) {
    const profile = await profileResponse.json();
    email = profile.mail || profile.userPrincipalName;
  }

  // 3. Save connection details in User profile
  const expiryDate = new Date(Date.now() + tokenData.expires_in * 1000);
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        outlookCalendar: {
          connected: true,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiryDate,
          email,
        },
      },
    }
  );

  res.redirect(`${frontendUrl}/availability?success=Outlook Calendar Connected`);
});

const disconnectOutlook = asyncHandler(async (req, res) => {
  await User.updateOne(
    { _id: req.user._id },
    {
      $set: {
        'outlookCalendar.connected': false,
        'outlookCalendar.accessToken': null,
        'outlookCalendar.refreshToken': null,
        'outlookCalendar.expiryDate': null,
        'outlookCalendar.email': null,
      },
    }
  );
  res.json({ ok: true });
});

module.exports = {
  connectGoogle,
  googleCallback,
  disconnectGoogle,
  connectOutlook,
  outlookCallback,
  disconnectOutlook,
};