import { Router } from 'express';
import User from '../models/User.js';
import Template from '../models/Template.js';
import EmailLog from '../models/EmailLog.js';
import BulkJob from '../models/BulkJob.js';
import { dueFollowUpsQuery, limitInfo, sentTodayCount } from '../services/sendEmail.js';
import { forgetAccessToken, revokeToken } from '../utils/gmail.js';
import { parsePdf } from '../utils/pdf.js';
import { config } from '../utils/config.js';
import { HttpError } from '../utils/errors.js';
import { baseCookie } from './auth.js';

const router = Router();

// Everything the app needs on load: who is signed in, Gmail status, today's sending count.
router.get('/', async (req, res) => {
  const u = req.user;
  const [sentToday, followUpsDue] = await Promise.all([
    sentTodayCount(u._id),
    EmailLog.countDocuments(dueFollowUpsQuery(u._id)),
  ]);
  res.json({
    email: u.email,
    name: u.name,
    picture: u.picture,
    senderName: u.senderName,
    gmailConnected: u.gmailConnected,
    defaultResumeName: u.defaultResumeName,
    followUpsDue,
    bulkGapSeconds: config.bulkGapMs / 1000,
    ...limitInfo(sentToday),
  });
});

// Settings: sender name and default resume.
router.put('/', async (req, res) => {
  const { senderName, resumeBase64, resumeName, removeResume } = req.body;
  const user = await User.findById(req.user._id);

  if (senderName !== undefined) {
    const name = String(senderName).trim();
    if (!name) throw new HttpError(400, 'Sender name cannot be empty');
    if (name.length > 100) throw new HttpError(400, 'Sender name is too long');
    user.senderName = name;
  }
  if (removeResume) {
    user.defaultResumeName = '';
    user.defaultResumeData = undefined;
  } else if (resumeBase64) {
    user.defaultResumeData = parsePdf(resumeBase64);
    user.defaultResumeName = resumeName || 'Resume.pdf';
  }

  await user.save();
  res.json({ ok: true });
});

// "Delete my account": removes all of the user's data and revokes our Google access (PRD US-03).
router.delete('/', async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId).select('+refreshTokenEnc');
  if (user?.refreshTokenEnc) await revokeToken(user.refreshTokenEnc);
  forgetAccessToken(userId);

  await Promise.all([
    Template.deleteMany({ userId }),
    EmailLog.deleteMany({ userId }),
    BulkJob.deleteMany({ userId }),
  ]);
  await User.deleteOne({ _id: userId });

  res.clearCookie('session', baseCookie());
  res.json({ ok: true });
});

export default router;
