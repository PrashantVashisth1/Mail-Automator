// All settings come from server/.env. Read lazily so dotenv has loaded first.
const REQUIRED = [
  'MONGO_URI',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'SERVER_URL',
  'CLIENT_URL',
  'JWT_SECRET',
  'TOKEN_ENCRYPTION_KEY',
];

const num = (value, fallback) => {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(n) ? n : fallback;
};
const trimSlash = (url) => (url || '').replace(/\/+$/, '');

export const config = {
  get serverUrl() {
    return trimSlash(process.env.SERVER_URL);
  },
  get clientUrl() {
    return trimSlash(process.env.CLIENT_URL);
  },
  get dailyLimit() {
    return num(process.env.DAILY_SEND_LIMIT, 50);
  },
  get bulkGapMs() {
    return num(process.env.BULK_GAP_SECONDS, 45) * 1000;
  },
  // true = don't really send, just log. Useful for testing bulk sends.
  get dryRun() {
    return process.env.MAIL_DRY_RUN === 'true';
  },
  // Deployed over HTTPS (client and server on different domains) needs Secure + SameSite=None cookies.
  get secureCookies() {
    return this.serverUrl.startsWith('https://');
  },
};

export function checkConfig() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing settings in server/.env: ${missing.join(', ')}. See server/.env.example.`);
  }
  if (!/^[0-9a-fA-F]{64}$/.test(process.env.TOKEN_ENCRYPTION_KEY)) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex characters. See server/.env.example for how to generate it.');
  }
}
