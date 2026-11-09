import { Router } from 'express';
import Template from '../models/Template.js';
import EmailLog from '../models/EmailLog.js';
import { fill, toHtml } from '../utils/render.js';
import { getTransporter } from '../utils/mailer.js';
import { loadGlobalResume } from '../utils/resume.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/send', async (req, res) => {
  const hrName = req.body.hrName?.trim();
  const companyName = req.body.companyName?.trim();
  const email = req.body.email?.trim();
  const { templateId } = req.body;

  if (!hrName || !companyName || !email || !templateId) {
    return res.status(400).json({ error: 'HR name, company name, email and template are required' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const template = await Template.findById(templateId).select('+resumeData');
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const vars = { hrName, companyName, senderName: process.env.SENDER_NAME || '' };
  const subject = fill(template.subject, vars);
  const text = fill(template.body, vars);

  // Role-specific resume first, global RESUME_PATH as fallback.
  const attachments = [];
  try {
    if (template.resumeData?.length) {
      attachments.push({
        filename: template.resumeName || 'Resume.pdf',
        content: template.resumeData,
        contentType: 'application/pdf',
      });
    } else {
      const fallback = await loadGlobalResume();
      if (fallback) attachments.push(fallback);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const log = { hrName, companyName, email, templateName: template.name, subject };
  try {
    await getTransporter().sendMail({
      from: `"${process.env.SENDER_NAME || ''}" <${process.env.GMAIL_USER}>`,
      to: email,
      subject,
      text,
      html: toHtml(text),
      attachments,
    });
    await EmailLog.create({ ...log, status: 'sent' });
    res.json({ ok: true, message: `Mail sent to ${hrName} at ${companyName}` });
  } catch (err) {
    await EmailLog.create({ ...log, status: 'failed', error: err.message });
    res.status(500).json({ error: `Failed to send: ${err.message}` });
  }
});

router.get('/history', async (req, res) => {
  const logs = await EmailLog.find().sort({ createdAt: -1 }).limit(500);
  res.json(logs);
});

export default router;