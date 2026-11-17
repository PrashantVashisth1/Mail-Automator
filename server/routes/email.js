import { Router } from 'express';
import EmailLog, { OUTCOMES } from '../models/EmailLog.js';
import {
  EMAIL_RE,
  FOLLOW_UP_DAYS,
  findRecentDuplicate,
  limitInfo,
  sendOne,
  sentTodayCount,
} from '../services/sendEmail.js';
import { HttpError, asSendError, checkId } from '../utils/errors.js';

const router = Router();
const MIN_SENDS_FOR_RATE = 5; // fewer sends than this shows "Not enough data" (PRD US-06)

router.post('/send', async (req, res) => {
  const hrName = req.body.hrName?.trim();
  const companyName = req.body.companyName?.trim();
  const email = req.body.email?.trim().toLowerCase();
  const followUpDays = Number(req.body.followUpDays) || 0;
  const { templateId, sendAnyway } = req.body;

  if (!hrName || !companyName || !email || !templateId) {
    throw new HttpError(400, 'HR name, company name, email and template are required');
  }
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Invalid email address');
  if (!FOLLOW_UP_DAYS.includes(followUpDays)) throw new HttpError(400, 'Follow-up must be 3, 5 or 7 days');
  checkId(templateId, 'Template');

  // PRD US-04: warn before emailing someone already contacted in the last 30 days.
  const duplicate = await findRecentDuplicate(req.user._id, email);
  if (duplicate && !sendAnyway) {
    throw new HttpError(409, 'You already emailed this address recently.', 'DUPLICATE', {
      previous: {
        date: duplicate.createdAt,
        companyName: duplicate.companyName,
        templateName: duplicate.templateName,
      },
    });
  }

  try {
    await sendOne({
      user: req.user,
      templateId,
      hrName,
      companyName,
      email,
      followUpDays,
      sentAnyway: Boolean(duplicate),
      source: 'form',
    });
  } catch (err) {
    throw asSendError(err);
  }
  res.json({
    ok: true,
    message: `Mail sent to ${hrName} at ${companyName}`,
    ...limitInfo(await sentTodayCount(req.user._id)),
  });
});

router.get('/history', async (req, res) => {
  const logs = await EmailLog.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(500)
    .select('-gmailMessageId -gmailThreadId -messageIdHeader');
  res.json(logs);
});

// PRD US-06: mark what happened after sending. Only for successful original emails.
router.patch('/history/:id/outcome', async (req, res) => {
  const { outcome } = req.body;
  if (!OUTCOMES.includes(outcome)) throw new HttpError(400, `Outcome must be one of: ${OUTCOMES.join(', ')}`);
  const log = await EmailLog.findOneAndUpdate(
    { _id: checkId(req.params.id, 'Email'), userId: req.user._id, status: 'sent', parentLogId: null },
    { outcome, outcomeUpdatedAt: new Date() },
    { new: true }
  );
  if (!log) throw new HttpError(404, 'Email not found');
  res.json(log);
});

// Reply rate per template. Counts original emails only (not follow-ups).
// Replied, Interview and Rejected all mean the HR responded.
router.get('/stats', async (req, res) => {
  const rows = await EmailLog.aggregate([
    { $match: { userId: req.user._id, status: 'sent', parentLogId: null } },
    {
      $group: {
        _id: '$templateName',
        sent: { $sum: 1 },
        replied: { $sum: { $cond: [{ $ne: ['$outcome', 'no_response'] }, 1, 0] } },
      },
    },
    { $sort: { sent: -1 } },
  ]);
  res.json(
    rows.map((r) => ({
      templateName: r._id,
      sent: r.sent,
      replied: r.replied,
      replyRate: r.sent >= MIN_SENDS_FOR_RATE ? r.replied / r.sent : null,
    }))
  );
});

export default router;
