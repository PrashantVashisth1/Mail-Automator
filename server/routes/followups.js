import { Router } from 'express';
import EmailLog from '../models/EmailLog.js';
import { dueFollowUpsQuery, sendOne } from '../services/sendEmail.js';
import { HttpError, asSendError, checkId } from '../utils/errors.js';

const router = Router();

// PRD US-07: emails whose reminder date has passed and that still have no reply.
router.get('/', async (req, res) => {
  const logs = await EmailLog.find(dueFollowUpsQuery(req.user._id))
    .sort({ followUpAt: 1 })
    .limit(200)
    .select('-gmailMessageId -gmailThreadId -messageIdHeader');
  res.json(logs);
});

// Send a follow-up to the same HR, in the same Gmail conversation as the original email.
router.post('/:id/send', async (req, res) => {
  const parent = await EmailLog.findOne({
    _id: checkId(req.params.id, 'Email'),
    userId: req.user._id,
    status: 'sent',
    parentLogId: null,
  });
  if (!parent) throw new HttpError(404, 'Email not found');
  checkId(req.body.templateId, 'Template');

  try {
    await sendOne({
      user: req.user,
      templateId: req.body.templateId,
      hrName: parent.hrName,
      companyName: parent.companyName,
      email: parent.email,
      parent,
      source: 'followup',
    });
  } catch (err) {
    throw asSendError(err);
  }

  // Removes it from the "Follow-ups due" list.
  await EmailLog.updateOne({ _id: parent._id }, { followUpDoneAt: new Date() });
  res.json({ ok: true, message: `Follow-up sent to ${parent.hrName} at ${parent.companyName}` });
});

export default router;
