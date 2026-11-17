import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { encrypt } from '../utils/crypto.js';
import { cacheAccessToken } from '../utils/gmail.js';
import { config } from '../utils/config.js';
import { seedTemplatesForUser } from '../seed.js';

const router = Router();

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
// Send-only: we can send as the user but can never read their inbox.
const SCOPES = ['openid', 'email', 'profile', GMAIL_SEND_SCOPE];
const SESSION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const redirectUri = () => `${config.serverUrl}/api/auth/google/callback`;

// httpOnly: page JavaScript can't read the cookie. Lax is enough on localhost; a deployed
// client and server on different domains need SameSite=None + Secure.
export const baseCookie = () => ({
  httpOnly: true,
  secure: config.secureCookies,
  sameSite: config.secureCookies ? 'none' : 'lax',
  path: '/',
});

// Step 1: send the user to Google's consent screen.
router.get('/google', (req, res) => {
  // Random "state" stored in a cookie and checked on return, so nobody can forge the callback.
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, { ...baseCookie(), maxAge: 10 * 60 * 1000 });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline', // gives a refresh token so we can send later without the user present
    prompt: 'consent', // always return a refresh token, even for returning users
    include_granted_scopes: 'true',
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// The id_token came straight from Google's token endpoint over HTTPS in exchange for our client
// secret, so it can be trusted without checking its signature. We still check who it is for.
function readIdToken(idToken) {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString());
    const fromGoogle = ['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss);
    if (!fromGoogle || payload.aud !== process.env.GOOGLE_CLIENT_ID || !payload.sub || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

// Step 2: Google sends the user back here with a one-time code.
router.get('/google/callback', async (req, res) => {
  const fail = (reason) => res.redirect(`${config.clientUrl}/?authError=${encodeURIComponent(reason)}`);
  const { code, state, error } = req.query;
  const expectedState = req.cookies.oauth_state;
  res.clearCookie('oauth_state', baseCookie());

  if (error) return fail(error === 'access_denied' ? 'Google sign-in was cancelled.' : `Google sign-in failed (${error}).`);
  if (!code || !state || state !== expectedState) return fail('Sign-in expired. Please try again.');

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok) return fail('Google sign-in failed. Please try again.');

    const profile = readIdToken(tokens.id_token);
    if (!profile) return fail('Could not read your Google profile. Please try again.');

    // On Google's consent screen the user can untick "send email". Then they can still sign in
    // and manage templates, but sending stays blocked until they reconnect (PRD US-02).
    const canSend = (tokens.scope || '').split(' ').includes(GMAIL_SEND_SCOPE) && Boolean(tokens.refresh_token);

    let user = await User.findOne({ googleId: profile.sub });
    const isNew = !user;
    if (isNew) user = new User({ googleId: profile.sub, senderName: profile.name || '' });
    user.email = profile.email;
    user.name = profile.name || '';
    user.picture = profile.picture || '';
    user.gmailConnected = canSend;
    if (tokens.refresh_token) user.refreshTokenEnc = encrypt(tokens.refresh_token);
    await user.save();

    if (isNew) await seedTemplatesForUser(user._id);
    if (canSend) cacheAccessToken(user._id, tokens.access_token, tokens.expires_in);

    const session = jwt.sign({ uid: String(user._id) }, process.env.JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
    res.cookie('session', session, { ...baseCookie(), maxAge: SESSION_DAYS * DAY_MS });
    res.redirect(config.clientUrl);
  } catch (err) {
    console.error('Google callback error:', err);
    fail('Something went wrong during sign-in. Please try again.');
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('session', baseCookie());
  res.json({ ok: true });
});

export default router;
