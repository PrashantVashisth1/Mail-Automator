import EmailLog from '../models/EmailLog.js';
import Template from '../models/Template.js';
import User from '../models/User.js';
import { fill, toHtml } from '../utils/render.js';
import { sendGmail } from '../utils/gmail.js';
import { config } from '../utils/config.js';
import { HttpError } from '../utils/errors.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const FOLLOW_UP_DAYS = [0, 3, 5, 7]; // 0 = no reminder
export const DUPLICATE_WINDOW_MS = 30 * DAY_MS;

// Midnight of "today" in India time (the daily limit resets then), as a normal Date.
export function startOfTodayIST(now = Date.now()) {
  return new Date(Math.floor((now + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS);
}

export function sentTodayCount(userId) {
  return EmailLog.countDocuments({ userId, status: 'sent', createdAt: { $gte: startOfTodayIST() } });
}

export function limitInfo(sentToday) {
  return {
    sentToday,
    dailyLimit: config.dailyLimit,
    resetsAt: new Date(startOfTodayIST().getTime() + DAY_MS),
  };
}

// Last successful email to this address in the past 30 days (failed sends don't count).
export function findRecentDuplicate(userId, email) {
  return EmailLog.findOne({
    userId,
    email: email.trim().toLowerCase(),
    status: 'sent',
    createdAt: { $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
  }).sort({ createdAt: -1 });
}

// Original emails whose reminder date has passed and that still have no reply.
export const dueFollowUpsQuery = (userId) => ({
  userId,
  status: 'sent',
  parentLogId: null,
  outcome: 'no_response',
  followUpDoneAt: null,
  followUpAt: { $lte: new Date() },
});

// Template's own resume first, otherwise the user's default resume from Settings.
async function attachmentsFor(userId, template) {
  if (template.resumeData?.length) {
    return [{ filename: template.resumeName || 'Resume.pdf', content: template.resumeData, contentType: 'application/pdf' }];
  }
  const user = await User.findById(userId).select('+defaultResumeData');
  if (user?.defaultResumeData?.length) {
    return [{ filename: user.defaultResumeName || 'Resume.pdf', content: user.defaultResumeData, contentType: 'application/pdf' }];
  }
  return [];
}

/**
 * The one place an email is sent from: the Send form, follow-ups and CSV jobs all call this.
 * Checks the daily limit, fills placeholders, attaches the resume, sends through Gmail and
 * writes the history log. Pass `parent` (an EmailLog) to send a follow-up in the same thread.
 */
export async function sendOne({
  user,
  templateId,
  hrName,
  companyName,
  email,
  followUpDays = 0,
  parent = null,
  sentAnyway = false,
  source = 'form',
}) {
  const template = await Template.findOne({ _id: templateId, userId: user._id }).select('+resumeData');
  if (!template) throw new HttpError(404, 'Template not found');

  const sentToday = await sentTodayCount(user._id);
  if (sentToday >= config.dailyLimit) {
    throw new HttpError(
      429,
      `Daily limit of ${config.dailyLimit} emails reached. It resets at midnight (IST).`,
      'DAILY_LIMIT',
      limitInfo(sentToday)
    );
  }

  const vars = { hrName, companyName, senderName: user.senderName || user.name || '' };
  // A follow-up keeps the original subject with "Re:" so Gmail groups it into the same conversation.
  const subject = parent ? `Re: ${(parent.subject || '').replace(/^Re:\s*/i, '')}` : fill(template.subject, vars);
  const text = fill(template.body, vars);

  const log = {
    userId: user._id,
    hrName,
    companyName,
    email,
    templateName: template.name,
    subject,
    source,
    sentAnyway,
    parentLogId: parent?._id,
  };

  try {
    const ids = await sendGmail(user._id, {
      from: { name: vars.senderName, address: user.email },
      to: email,
      subject,
      text,
      html: toHtml(text),
      attachments: await attachmentsFor(user._id, template),
      ...(parent?.gmailThreadId && { threadId: parent.gmailThreadId }),
      ...(parent?.messageIdHeader && { inReplyTo: parent.messageIdHeader, references: parent.messageIdHeader }),
    });
    return await EmailLog.create({
      ...log,
      ...ids,
      status: 'sent',
      followUpAt: followUpDays > 0 ? new Date(Date.now() + followUpDays * DAY_MS) : undefined,
    });
  } catch (err) {
    // Gmail not connected means nothing was attempted, so it isn't a failed email.
    if (err.code !== 'GMAIL_RECONNECT') {
      await EmailLog.create({ ...log, status: 'failed', error: err.message });
    }
    throw err;
  }
}
