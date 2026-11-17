import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import Template from './models/Template.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import templateRoutes from './routes/templates.js';
import emailRoutes from './routes/email.js';
import followUpRoutes from './routes/followups.js';
import bulkRoutes from './routes/bulk.js';
import { requireAuth } from './middleware/requireAuth.js';
import { startBulkWorker } from './services/bulkWorker.js';
import { checkConfig, config } from './utils/config.js';

checkConfig(); // stop early with a clear message if server/.env is incomplete

const app = express();

// credentials: true lets the browser send the session cookie to the API.
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());

let databaseReady;

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) return;

  if (!databaseReady) {
    databaseReady = mongoose
      .connect(process.env.MONGO_URI)
      // v1 made template names unique across ALL users; this swaps that index for (userId, name).
      .then(() => Template.syncIndexes())
      .catch((error) => {
        databaseReady = undefined;
        throw error;
      });
  }

  await databaseReady;
}

// Connect before serving API requests.
app.use('/api', async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    next(error);
  }
});

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Mail Automator API is running' });
});

// Public: Google sign-in.
app.use('/api/auth', authRoutes);

// Everything below needs a signed-in user.
app.use('/api', requireAuth);
app.use('/api/me', meRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/followups', followUpRoutes);
app.use('/api/bulk', bulkRoutes);
app.use('/api', emailRoutes);

app.use((err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  if (err.name === 'ValidationError') status = 400;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: err.message || 'Server error',
    ...(err.code && typeof err.code === 'string' && { code: err.code }),
    ...(err.data && { data: err.data }),
  });
});

app.listen(process.env.PORT || 5001, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 5001}`);
});

// The CSV bulk sender connects to MongoDB itself on each tick, so it works even if the
// database comes up after the server.
startBulkWorker(connectToDatabase);
connectToDatabase().catch((error) => console.error('Could not connect to MongoDB:', error.message));

export default app;
