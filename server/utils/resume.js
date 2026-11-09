import fs from 'fs';
import path from 'path';

// Accepts a local path OR a Google Drive / direct http(s) link.
// Used only as a fallback when a template has no resume uploaded.
export async function loadGlobalResume() {
  const raw = (process.env.RESUME_PATH || '').trim().replace(/^["']|["']$/g, '').trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    const driveId = raw.match(/\/d\/([\w-]+)/)?.[1] || raw.match(/[?&]id=([\w-]+)/)?.[1];
    const url = driveId ? `https://drive.google.com/uc?export=download&id=${driveId}` : raw;
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`Could not download resume (${res.status})`);
    const type = res.headers.get('content-type') || '';
    if (type.includes('text/html')) {
      throw new Error('Resume link is not public. Share it as "Anyone with the link" or upload a PDF to the template.');
    }
    return { filename: 'Resume.pdf', content: Buffer.from(await res.arrayBuffer()) };
  }

  if (!fs.existsSync(raw)) throw new Error(`Resume not found at RESUME_PATH: ${raw}`);
  return { filename: path.basename(raw), path: raw };
}