import mongoose from 'mongoose';

// One CSV upload = one job. The worker (services/bulkWorker.js) sends its rows one by one.
const rowSchema = new mongoose.Schema(
  {
    hrName: String,
    companyName: String,
    email: String,
    status: { type: String, enum: ['queued', 'sent', 'failed', 'cancelled'], default: 'queued' },
    error: String,
    logId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailLog' },
  },
  { _id: false }
);

const bulkJobSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template', required: true },
    templateName: String,
    followUpDays: { type: Number, default: 0 },
    status: { type: String, enum: ['running', 'paused', 'completed', 'cancelled'], default: 'running' },
    // Why a job is paused: 'daily_limit' or 'gmail_reconnect'.
    pauseReason: String,
    // The worker sends the next row only after this time (gap between emails).
    nextRunAt: { type: Date, default: Date.now },
    rows: [rowSchema],
  },
  { timestamps: true }
);

bulkJobSchema.index({ status: 1, nextRunAt: 1 });

export default mongoose.model('BulkJob', bulkJobSchema);
