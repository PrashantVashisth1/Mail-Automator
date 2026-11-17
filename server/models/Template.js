import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    // Dedicated resume for this template (role-specific). Optional.
    resumeName: { type: String, default: '' },
    resumeData: { type: Buffer, select: false },
  },
  { timestamps: true }
);

// Template names are unique per user, not across all users (PRD US-03).
templateSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model('Template', templateSchema);
