import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import templateRoutes from './routes/templates.js';
import emailRoutes from './routes/email.js';
import { seedTemplates } from './seed.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '4mb' }));

let databaseReady;

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) return;

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not configured');
  }

  if (!databaseReady) {
    databaseReady = mongoose
      .connect(process.env.MONGO_URI)
      .then(async () => {
        await seedTemplates();
      })
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

app.get('/api/config', (req, res) => {
  res.json({
    senderEmail: process.env.GMAIL_USER || '',
    senderName: process.env.SENDER_NAME || '',
    resumeAttached: Boolean(process.env.RESUME_PATH),
  });
});

app.use('/api/templates', templateRoutes);
app.use('/api', emailRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

app.listen(process.env.PORT || 5001, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 5001}`);
});

export default app;