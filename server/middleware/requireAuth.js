import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { HttpError } from '../utils/errors.js';

// Runs before every protected route: reads the session cookie and loads the signed-in user
// into req.user. Every route then filters its database queries by req.user._id.
export async function requireAuth(req, res, next) {
  let uid;
  try {
    uid = jwt.verify(req.cookies?.session, process.env.JWT_SECRET).uid;
  } catch {
    return next(new HttpError(401, 'Please sign in.', 'AUTH_REQUIRED'));
  }

  const user = await User.findById(uid);
  if (!user) return next(new HttpError(401, 'Please sign in.', 'AUTH_REQUIRED'));

  req.user = user;
  next();
}
