import { Router } from 'express';
import BulkJob from '../models/BulkJob.js';
import EmailLog from '../models/EmailLog.js';
import Template from '../models/Template.js';
import { config } from '../utils/config.js';
import {
  DUPLICATE_WINDOW_MS,
  EMAIL_RE,
  FOLLOW_UP_DAYS,
  limitInfo,
  sentTodayCount,
} from '../services/sendEmail.js';
import { HttpError, checkId, reconnectError } from '../utils/errors.js';

const router = Router();
const MAX_ROWS = 100;

const own = (req) => ({ _id: checkId(req.params.id, 'Job'), userId: req.user._id });

// Review step: which of these emails were already contacted in the last 30 days?
router.post('/check', async (req, res) => {
  const emails = (Array.isArray(req.body.emails) ? req.body.emails : [])
    .slice(0, MAX_ROWS)
    .map((e) => String(e).trim().toLowerCase());
  const logs = await EmailLog.find({
    userId: req.user._id,
    status: 'sent',
    email: { $in: emails },
    createdAt: { $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
  }).sort({ createdAt: -1 });

  const duplicates = {};
  for (const l of logs) {
    if (!duplicates[l.email]) {
      duplicates[l.email] = { date: l.createdAt, companyName: l.companyName, templateName: l.templateName };
    }
  }
  res.json({ duplicates });
});

// Start a job. The client already validated the CSV, but never trust the client: check again.
router.post('/', async (req, res) => {
  const followUpDays = Number(req.body.followUpDays) || 0;
  if (!FOLLOW_UP_DAYS.includes(followUpDays)) throw new HttpError(400, 'Follow-up must be 3, 5 or 7 days');

  const template = await Template.findOne({ _id: checkId(req.body.templateId, 'Template'), userId: req.user._id });
  if (!template) throw new HttpError(404, 'Template not found');

  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) throw new HttpError(400, 'Add at least one contact');
  if (rows.length > MAX_ROWS) throw new HttpError(400, `A CSV can have at most ${MAX_ROWS} contacts`);

  const seen = new Set();
  const clean = rows.map((r, i) => {
    const hrName = String(r.hrName ?? '').trim();
    const companyName = String(r.companyName ?? '').trim();
    const email = String(r.email ?? '').trim().toLowerCase();
    if (!hrName || !companyName || !EMAIL_RE.test(email)) {
      throw new HttpError(400, `Row ${i + 1} needs an HR name, company name and valid email`);
    }
    if (seen.has(email)) throw new HttpError(400, `Row ${i + 1}: ${email} appears twice in the file`);
    seen.add(email);
    return { hrName, companyName, email };
  });

  if (!req.user.gmailConnected) throw reconnectError();

  const job = await BulkJob.create({
    userId: req.user._id,
    templateId: template._id,
    templateName: template.name,
    followUpDays,
    rows: clean,
  });
  res.status(201).json(job);
});

router.get('/', async (req, res) => {
  const jobs = await BulkJob.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(10);
  res.json(jobs);
});

router.get('/:id', async (req, res) => {
  const job = await BulkJob.findOne(own(req));
  if (!job) throw new HttpError(404, 'Job not found');
  res.json(job);
});

// Continue a paused job (e.g. the next day after the daily limit, or after reconnecting Gmail).
router.post('/:id/resume', async (req, res) => {
  const job = await BulkJob.findOne(own(req));
  if (!job) throw new HttpError(404, 'Job not found');
  if (job.status !== 'paused') throw new HttpError(400, 'Only a paused job can be resumed');
  if (!req.user.gmailConnected) throw reconnectError();

  const sentToday = await sentTodayCount(req.user._id);
  if (sentToday >= config.dailyLimit) {
    throw new HttpError(429, 'Daily limit still reached. Resume after midnight (IST).', 'DAILY_LIMIT', limitInfo(sentToday));
  }

  job.status = 'running';
  job.pauseReason = undefined;
  job.nextRunAt = new Date();
  await job.save();
  res.json(job);
});

// Stop the job: rows not yet sent become "cancelled".
router.post('/:id/cancel', async (req, res) => {
  const filter = own(req);
  const job = await BulkJob.findOne(filter);
  if (!job) throw new HttpError(404, 'Job not found');
  if (job.status === 'running' || job.status === 'paused') {
    await BulkJob.updateOne(
      filter,
      { $set: { status: 'cancelled', 'rows.$[q].status': 'cancelled' } },
      { arrayFilters: [{ 'q.status': 'queued' }] }
    );
  }
  res.json(await BulkJob.findOne(filter));
});

export default router;
