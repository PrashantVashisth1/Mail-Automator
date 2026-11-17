import crypto from 'crypto';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import User from '../models/User.js';
import { decrypt } from './crypto.js';
import { config } from './config.js';
import { reconnectError } from './errors.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

// Access tokens live ~1 hour. Keep them in memory so we don't ask Google for a new one per email.
const tokenCache = new Map(); // userId -> { token, expiresAt }

export function cacheAccessToken(userId, token, expiresInSeconds) {
  tokenCache.set(String(userId), { token, expiresAt: Date.now() + (expiresInSeconds - 60) * 1000 });
}

export function forgetAccessToken(userId) {
  tokenCache.delete(String(userId));
}

async function markDisconnected(userId) {
  forgetAccessToken(userId);
  await User.updateOne({ _id: userId }, { gmailConnected: false });
}

// Returns a valid access token, using the saved refresh token when the cached one has expired.
async function getAccessToken(userId) {
  const cached = tokenCache.get(String(userId));
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const user = await User.findById(userId).select('+refreshTokenEnc');
  if (!user?.gmailConnected || !user.refreshTokenEnc) throw reconnectError();

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: decrypt(user.refreshTokenEnc),
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // invalid_grant = user revoked access, or the 7-day Testing-mode token expired.
    if (data.error === 'invalid_grant') {
      await markDisconnected(userId);
      throw reconnectError();
    }
    throw new Error(`Could not refresh Google access: ${data.error_description || data.error || res.status}`);
  }
  cacheAccessToken(userId, data.access_token, data.expires_in);
  return data.access_token;
}

// Builds the full email (headers, HTML, PDF attachment) the same way Nodemailer does.
function buildRaw(message) {
  return new Promise((resolve, reject) => {
    new MailComposer(message).compile().build((err, buf) => (err ? reject(err) : resolve(buf.toString('base64url'))));
  });
}

/**
 * Sends one email from the user's own Gmail.
 * message: { from, to, subject, text, html, attachments, inReplyTo, references, threadId }
 * Returns ids we store so a follow-up can be sent in the same conversation.
 */
export async function sendGmail(userId, { threadId, ...message }) {
  const messageIdHeader = `<${crypto.randomUUID()}@mail-automator>`;
  const raw = await buildRaw({ ...message, messageId: messageIdHeader });

  if (config.dryRun) {
    console.log(`[dry-run] Not sending "${message.subject}" to ${message.to}`);
    return {
      gmailMessageId: `dry-${crypto.randomUUID()}`,
      gmailThreadId: threadId || `dry-thread-${crypto.randomUUID()}`,
      messageIdHeader,
    };
  }

  const body = JSON.stringify(threadId ? { raw, threadId } : { raw });
  let res;
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getAccessToken(userId);
    res = await fetch(SEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body,
    });
    if (res.status !== 401) break;
    forgetAccessToken(userId); // cached token stopped working early; get a fresh one and retry once
  }

  const data = await res.json().catch(() => ({}));
  const apiMessage = data.error?.message || '';
  if (res.status === 401 || (res.status === 403 && /scope/i.test(apiMessage))) {
    await markDisconnected(userId);
    throw reconnectError();
  }
  if (!res.ok) throw new Error(apiMessage || `Gmail API error (${res.status})`);

  return { gmailMessageId: data.id, gmailThreadId: data.threadId, messageIdHeader };
}

// Best effort: tell Google to drop our access when a user deletes their account.
export async function revokeToken(refreshTokenEnc) {
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: decrypt(refreshTokenEnc) }),
    });
  } catch {
    // ignore: the account data is deleted either way
  }
}
