# Cold Mail Sender (MERN)

Send personalised job-application emails to HRs from your own Gmail. Each student signs in with
Google, picks a template, and the app fills in `{{hrName}}`, `{{companyName}}` and `{{senderName}}`.

## Features

- **Google sign-in, send from your own Gmail.** The app asks only for Gmail's *send* permission, so it
  can never read your inbox. Every user's templates, resumes and history are private.
- **Duplicate warning.** Before you email an address you already emailed in the last 30 days, the app
  shows when and from which template, and lets you cancel or send anyway.
- **Daily sending limit** per user (default 50, resets at midnight IST), to protect your Gmail from
  being flagged as spam.
- **Reply tracking.** Mark each email as Replied, Interview, Rejected or No response, and see the
  reply rate per template.
- **Follow-up reminders.** Pick 3, 5 or 7 days when sending. Emails still without a reply show up
  under *Follow-ups*, and the follow-up goes out in the same Gmail conversation.
- **Bulk send from CSV.** Upload up to 100 contacts, review problems and duplicates, then the server
  sends one email at a time with a gap between them, pausing at the daily limit.
- Seven starter templates (Frontend, Backend, Full Stack, SDE, Internship, Referral, Follow-up) are
  copied to each new user. Edit them under **Templates**.

## Setup

### 1. MongoDB
Run it locally, or create a free cluster on MongoDB Atlas and copy its connection string.

### 2. Google Cloud (about 10 minutes, once)
1. Open https://console.cloud.google.com and create a project (for example "Mail Automator").
2. **APIs & Services → Library**: search for **Gmail API** and click **Enable**.
3. **Google Auth Platform → Branding / Get started**: set the app name and support email, choose
   **External** as the audience, and finish the wizard.
4. **Audience → Test users**: add the Gmail address of everyone who will sign in (up to 100).
5. **Data access → Add or remove scopes**: add `.../auth/gmail.send` (plus `openid`,
   `.../auth/userinfo.email`, `.../auth/userinfo.profile`) and save.
6. **Clients → Create client**: type **Web application**, and under **Authorized redirect URIs** add
   `http://localhost:5001/api/auth/google/callback`. Copy the **Client ID** and **Client secret**.

While the app is in *Testing* mode, Google shows a "Google hasn't verified this app" screen
(click **Continue**) and users have to sign in again every 7 days. Publishing for more than 100 users
needs Google's verification.

### 3. Server config
```bash
cd server
cp .env.example .env
```
Fill in `MONGO_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and generate the two secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # run twice: JWT_SECRET, TOKEN_ENCRYPTION_KEY
```

### 4. Client config
Create `client/.env` with:
```
VITE_API_URL=http://localhost:5001
```

## Run

```bash
# terminal 1
cd server && npm install && npm run dev

# terminal 2
cd client && npm install && npm run dev
```

Open http://localhost:5173, sign in with Google, then set your name and default resume under
**Settings**.

## Settings (`server/.env`)

| Variable | What it does |
|---|---|
| `SERVER_URL`, `CLIENT_URL` | Where the API and web app run. Used for the Google redirect and cookies. In production both are the Vercel URL |
| `JWT_SECRET` | Signs the login cookie |
| `TOKEN_ENCRYPTION_KEY` | 64 hex chars. Encrypts Google tokens in MongoDB. Changing it signs everyone out |
| `DAILY_SEND_LIMIT` | Max successful emails per user per day (default 50) |
| `BULK_GAP_SECONDS` | Gap between emails in a CSV bulk send (default 45) |
| `MAIL_DRY_RUN` | `true` = nothing is really sent, emails are only logged. Handy for testing |

## How it works

```
Browser --(httpOnly session cookie)--> Express API --> MongoDB
                                          |
                                          +--> Google OAuth (sign-in, send permission)
                                          +--> Gmail API (send as the user)
Bulk worker (inside the server): every few seconds sends the next queued CSV row
```

- `server/services/sendEmail.js` is the one place an email is sent from (form, follow-ups and CSV).
  It checks the daily limit, fills placeholders, attaches the resume, sends and writes the history.
- Google refresh tokens are encrypted with AES-256-GCM before they are saved.
- Every database query is filtered by the signed-in user's id.

## Deploying (free: MongoDB Atlas + Vercel + cron-job.org)

Both the web app and the API run on Vercel as two projects. The browser only ever talks to the web
app's domain; it forwards `/api/*` to the API project (see `client/vercel.json`), so the login cookie
is first-party and isn't blocked by browsers like Brave or Safari. Serverless functions don't sleep
or count hours, and nothing runs between requests, so a free cron calls `/api/bulk/tick` every minute
to send the next CSV email.

1. **MongoDB Atlas**: create a free M0 cluster, a database user (letters and numbers only in the
   password), allow network access from `0.0.0.0/0`, and copy the connection string with the
   database name before the `?`, e.g. `...mongodb.net/mail-automator?retryWrites=true`.
2. **Vercel, API project** → Add New → Project → this repo. Name `mail-automator-api`, root directory
   `server`. Environment variables: everything from `server/.env.example`, with `MONGO_URI` from Atlas,
   `SERVER_URL` = `CLIENT_URL` = the web app's URL (step 3), `BULK_GAP_SECONDS=60` and a random
   `CRON_SECRET`. If the URL isn't `https://mail-automator-api.vercel.app`, put yours in
   `client/vercel.json`.
3. **Vercel, web project** → Add New → Project → same repo. Root directory `client`, framework Vite.
   Optionally set `VITE_CONTACT_EMAIL`. Do **not** set `VITE_API_URL`.
4. **cron-job.org**: create a job for `https://<api-project>.vercel.app/api/bulk/tick`, every minute,
   with the request header `Authorization: Bearer <CRON_SECRET>`.
5. **Google Cloud**:
   - Clients → your client → redirect URI `https://<web-app>.vercel.app/api/auth/google/callback`.
   - Branding → home page `https://<web-app>.vercel.app`, privacy policy
     `https://<web-app>.vercel.app/privacy`, authorized domain `<web-app>.vercel.app`.
   - Audience → **Publish app**. Anyone with a Google account can then sign in after clicking through
     the "unverified app" screen, up to 100 users until the app passes Google verification.
6. Open the web app, sign in, and send yourself a test email.

Running on an always-on server instead (e.g. Render, a VPS)? Then no cron is needed: when `VERCEL` is
not set, the server starts its own bulk sender loop. Run exactly **one** instance.
## Docs

The product requirements for this version are in [docs/PRD.md](docs/PRD.md).

## Credits

Version 1 (single-user sender with templates and resume upload) was built by Aman Bhaskar.
