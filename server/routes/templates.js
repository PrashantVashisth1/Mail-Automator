import { Router } from 'express';
import Template from '../models/Template.js';

const router = Router();
const MAX_RESUME_BYTES = 2 * 1024 * 1024; // keep under Vercel's 4.5MB body limit (base64 adds ~33%)

// Never send the PDF bytes back to the client.
const pub = (t) => {
  const o = t.toObject();
  delete o.resumeData;
  return o;
};

// Turns { resumeBase64, resumeName, removeResume } from the request into DB fields.
function resumeFields({ resumeBase64, resumeName, removeResume }) {
  if (removeResume) return { resumeName: '', resumeData: undefined, unset: true };
  if (!resumeBase64) return {};
  const data = Buffer.from(resumeBase64, 'base64');
  if (data.length > MAX_RESUME_BYTES) throw new Error('Resume must be under 2 MB');
  if (data.subarray(0, 4).toString() !== '%PDF') throw new Error('Resume must be a PDF file');
  return { resumeName: resumeName || 'Resume.pdf', resumeData: data };
}

router.get('/', async (req, res) => {
  const templates = await Template.find().sort({ createdAt: 1 });
  res.json(templates.map(pub));
});

router.post('/', async (req, res) => {
  const { name, subject, body } = req.body;
  if (!name || !subject || !body) {
    return res.status(400).json({ error: 'name, subject and body are required' });
  }
  try {
    const { unset, ...resume } = resumeFields(req.body);
    const template = await Template.create({ name, subject, body, ...resume });
    res.status(201).json(pub(template));
  } catch (err) {
    const msg = err.code === 11000 ? 'A template with this name already exists' : err.message;
    res.status(400).json({ error: msg });
  }
});

router.put('/:id', async (req, res) => {
  const { name, subject, body } = req.body;
  try {
    const { unset, ...resume } = resumeFields(req.body);
    const update = { $set: { name, subject, body } };
    if (unset) {
      update.$set.resumeName = '';
      update.$unset = { resumeData: 1 };
    } else {
      Object.assign(update.$set, resume);
    }
    const template = await Template.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(pub(template));
  } catch (err) {
    const msg = err.code === 11000 ? 'A template with this name already exists' : err.message;
    res.status(400).json({ error: msg });
  }
});

router.delete('/:id', async (req, res) => {
  await Template.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

export default router;