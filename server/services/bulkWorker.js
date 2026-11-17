import BulkJob from '../models/BulkJob.js';
import User from '../models/User.js';
import { findRecentDuplicate, sendOne } from './sendEmail.js';
import { config } from '../utils/config.js';

// Background sender for CSV jobs. Every few seconds it picks jobs whose gap has passed and
// sends ONE row per job. State lives in MongoDB, so a server restart simply continues.
// Run a single server instance: two instances would both send the same row.

let busy = false; // stops two ticks overlapping if a send is slow

async function processJob(job) {
  const i = job.rows.findIndex((r) => r.status === 'queued');
  if (i === -1) {
    await BulkJob.updateOne({ _id: job._id, status: 'running' }, { status: 'completed' });
    return;
  }
  const row = job.rows[i];

  const user = await User.findById(job.userId);
  if (!user) {
    await BulkJob.updateOne({ _id: job._id }, { status: 'cancelled' });
    return;
  }

  const set = { nextRunAt: new Date(Date.now() + config.bulkGapMs) };
  try {
    // The user saw history duplicates in the review table and chose to keep them.
    const sentAnyway = Boolean(await findRecentDuplicate(user._id, row.email));
    const log = await sendOne({
      user,
      templateId: job.templateId,
      hrName: row.hrName,
      companyName: row.companyName,
      email: row.email,
      followUpDays: job.followUpDays,
      sentAnyway,
      source: 'csv',
    });
    set[`rows.${i}.status`] = 'sent';
    set[`rows.${i}.logId`] = log._id;
  } catch (err) {
    if (err.code === 'DAILY_LIMIT' || err.code === 'GMAIL_RECONNECT') {
      // Remaining rows stay queued; the user resumes the job later.
      const pauseReason = err.code === 'DAILY_LIMIT' ? 'daily_limit' : 'gmail_reconnect';
      await BulkJob.updateOne({ _id: job._id, status: 'running' }, { status: 'paused', pauseReason });
      return;
    }
    set[`rows.${i}.status`] = 'failed';
    set[`rows.${i}.error`] = err.message;
  }

  // Targeted updates (not job.save()) so a Cancel clicked mid-send isn't overwritten.
  await BulkJob.updateOne({ _id: job._id }, { $set: set });
  await BulkJob.updateOne(
    { _id: job._id, status: 'running', 'rows.status': { $ne: 'queued' } },
    { status: 'completed' }
  );
}

let lastError = ''; // log a repeating error (e.g. MongoDB down) once, not every tick

async function tick(ensureDb) {
  if (busy) return;
  busy = true;
  try {
    await ensureDb(); // reconnects if MongoDB was not up when the server started
    const jobs = await BulkJob.find({ status: 'running', nextRunAt: { $lte: new Date() } }).limit(20);
    for (const job of jobs) {
      await processJob(job).catch((err) => console.error(`Bulk job ${job._id} error:`, err.message));
    }
    lastError = '';
  } catch (err) {
    if (err.message !== lastError) console.error('Bulk worker error:', err.message);
    lastError = err.message;
  } finally {
    busy = false;
  }
}

export function startBulkWorker(ensureDb) {
  const everyMs = Math.max(1000, Math.min(5000, config.bulkGapMs));
  setInterval(() => tick(ensureDb), everyMs);
  console.log(`Bulk sender running (gap between emails: ${config.bulkGapMs / 1000}s)`);
}
