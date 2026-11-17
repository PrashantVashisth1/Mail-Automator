import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String, default: '' },
    picture: { type: String, default: '' },
    // Shown in the "From" line and used for {{senderName}}.
    senderName: { type: String, default: '' },
    // Google refresh token, AES-encrypted (see utils/crypto.js). Never sent to the browser.
    refreshTokenEnc: { type: String, select: false },
    // True only when the user granted the "send email" permission.
    gmailConnected: { type: Boolean, default: false },
    // Resume attached when a template has no resume of its own.
    defaultResumeName: { type: String, default: '' },
    defaultResumeData: { type: Buffer, select: false },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
