import mongoose from 'mongoose';

// An error that already knows its HTTP status. The error handler in index.js turns it into
// { error, code, data } so the client can react to specific cases (e.g. code 'DUPLICATE').
export class HttpError extends Error {
  constructor(status, message, code, data) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export const reconnectError = () =>
  new HttpError(401, 'Gmail is not connected. Please reconnect your Gmail account.', 'GMAIL_RECONNECT');

// A malformed id can't belong to the user, so answer "not found" instead of crashing with a 500.
export function checkId(id, what) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, `${what} not found`);
  return id;
}

// Errors from Gmail etc. become "Failed to send: ..." unless they already carry a status.
export function asSendError(err) {
  return err.status ? err : new HttpError(500, `Failed to send: ${err.message}`);
}
