import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    // Dedicated resume for this template (role-specific). Optional.
    resumeName: { type: String, default: '' },
    resumeData: { type: Buffer, select: false },
  },
  { timestamps: true }
);

export default mongoose.model('Template', templateSchema);