import { Router } from 'express';
import Template from '../models/Template.js';
import { parsePdf } from '../utils/pdf.js';
import { HttpError, checkId } from '../utils/errors.js';

const router = Router();

// Never send the PDF bytes back to the client.
const pub = (t) => {
  const o = t.toObject();
  delete o.resumeData;
  return o;
};

// Turns { resumeBase64, resumeName, removeResume } from the request into DB fields.
function resumeFields({ resumeBase64, resumeName, removeResume }) {
  if (removeResume) return { unset: true };
  if (!resumeBase64) return {};
  return { resumeName: resumeName || 'Resume.pdf', resumeData: parsePdf(resumeBase64) };
}

const duplicateName = (err) =>
  err.code === 11000 ? new HttpError(400, 'A template with this name already exists') : err;

// Every query includes userId, so a user only ever sees and changes their own templates.
const own = (req) => ({ _id: checkId(req.params.id, 'Template'), userId: req.user._id });

router.get('/', async (req, res) => {
  const templates = await Template.find({ userId: req.user._id }).sort({ createdAt: 1 });
  res.json(templates.map(pub));
});

router.post('/', async (req, res) => {
  const { name, subject, body } = req.body;
  if (!name || !subject || !body) throw new HttpError(400, 'name, subject and body are required');
  const { unset, ...resume } = resumeFields(req.body);
  try {
    const template = await Template.create({ userId: req.user._id, name, subject, body, ...resume });
    res.status(201).json(pub(template));
  } catch (err) {
    throw duplicateName(err);
  }
});

router.put('/:id', async (req, res) => {
  const { name, subject, body } = req.body;
  const { unset, ...resume } = resumeFields(req.body);
  const update = { $set: { name, subject, body } };
  if (unset) {
    update.$set.resumeName = '';
    update.$unset = { resumeData: 1 };
  } else {
    Object.assign(update.$set, resume);
  }
  try {
    const template = await Template.findOneAndUpdate(own(req), update, { new: true, runValidators: true });
    if (!template) throw new HttpError(404, 'Template not found');
    res.json(pub(template));
  } catch (err) {
    throw duplicateName(err);
  }
});

router.delete('/:id', async (req, res) => {
  const template = await Template.findOneAndDelete(own(req));
  if (!template) throw new HttpError(404, 'Template not found');
  res.json({ ok: true });
});

export default router;
