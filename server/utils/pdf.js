import { HttpError } from './errors.js';

// Keep under Vercel's 4.5MB body limit (base64 adds ~33%).
export const MAX_RESUME_BYTES = 2 * 1024 * 1024;

// Turns a base64 upload into PDF bytes, or throws a 400 the user can understand.
export function parsePdf(base64) {
  const data = Buffer.from(base64, 'base64');
  if (data.length > MAX_RESUME_BYTES) throw new HttpError(400, 'Resume must be under 2 MB');
  if (data.subarray(0, 4).toString() !== '%PDF') throw new HttpError(400, 'Resume must be a PDF file');
  return data;
}
