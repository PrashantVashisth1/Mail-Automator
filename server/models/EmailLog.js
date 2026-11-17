import mongoose from 'mongoose';

export const OUTCOMES = ['no_response', 'replied', 'interview', 'rejected'];

const emailLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hrName: String,
    companyName: String,
    // Stored lowercase so duplicate checks are case-insensitive.
    email: { type: String, lowercase: true, trim: true },
    templateName: String,
    subject: String,
    status: { type: String, enum: ['sent', 'failed'], required: true },
    error: String,
    source: { type: String, enum: ['form', 'csv', 'followup'], default: 'form' },
    // User chose "Send anyway" on the duplicate warning (PRD US-04).
    sentAnyway: { type: Boolean, default: false },

    // What happened after sending (PRD US-06). Only meaningful for sent originals.
    outcome: { type: String, enum: OUTCOMES, default: 'no_response' },
    outcomeUpdatedAt: Date,

    // Follow-up reminders (PRD US-07).
    followUpAt: Date, // remind on/after this time
    followUpDoneAt: Date, // set when a follow-up was sent
    parentLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailLog' }, // set on follow-up emails

    // Ids needed to send a follow-up in the same Gmail conversation.
    gmailMessageId: String,
    gmailThreadId: String,
    messageIdHeader: String,
  },
  { timestamps: true }
);

emailLogSchema.index({ userId: 1, email: 1, createdAt: -1 });

export default mongoose.model('EmailLog', emailLogSchema);
