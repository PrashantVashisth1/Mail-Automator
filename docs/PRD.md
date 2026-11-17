# PRD: Cold Outreach Assistant v2 (Multi-user Pilot)

| | |
|---|---|
| **Product owner** | Ankush Pandey |
| **Status** | Draft v0.1 |
| **Last updated** | 16 Nov 2026 |
| **Engineering** | _[names]_ |
| **Built on** | Mail Automator v1 by Aman Bhaskar (github.com/AmanBhaskar16/Mail-Automator) |

> Lines marked **TODO (research)** must be filled from real user interviews and usage data before this PRD is final. Numbers in `[brackets]` are provisional and should be revisited with engineering.

---

## 1. Summary

Today the tool works for one person on one laptop. v2 lets any student sign in with Google, send personalised cold emails from their own Gmail, avoid accidental duplicate emails, and record which emails got replies. This lets us run a pilot with `[20]` students and measure whether the tool improves their outreach.

## 2. Problem

Students applying off-campus send cold emails to HRs one at a time from Gmail. The pain points we expect:

1. **Repetitive writing:** the same email is rewritten or copy-pasted for every company, which causes mistakes such as the wrong company name.
2. **Duplicates:** students forget whom they already emailed and contact the same HR twice.
3. **No follow-ups:** an email with no reply is forgotten instead of being followed up.
4. **No learning:** students don't know which version of their email gets replies.

> **TODO (research):** replace the list above with evidence from interviews, for example "6 of 8 students said they had emailed the same HR twice". Keep only the pain points the interviews confirm.

v1 already solves pain point 1 (templates with placeholders). Points 2-4 are unsolved, and v1 cannot be used by anyone except the person who installed it.

## 3. Current state (v1)

| Area | v1 behaviour |
|---|---|
| Stack | React (Vite) client, Node.js/Express 5 API, MongoDB (Mongoose), Nodemailer over Gmail SMTP |
| Sender | One Gmail account and its App Password, set in the server `.env` |
| Templates | Create, edit, delete. Name, subject, body. Placeholders `{{hrName}}`, `{{companyName}}`, `{{senderName}}`. 6 starter templates are seeded on first start |
| Resume | Optional PDF per template (max 2 MB, stored in MongoDB). Falls back to one global resume (`RESUME_PATH`: file path or public Google Drive link) |
| Sending | One recipient at a time, with a live preview. Sent as plain text plus simple HTML |
| History | Last 500 sends, each with status `sent` or `failed` and the error message |
| Users / auth | None. Everyone who opens the app shares one sender, one set of templates and one history |
| Hosting | Runs on localhost. `vercel.json` files exist for deployment |

**Limitations that drive v2:**
1. One sender and no sign-in, so no second user can be onboarded.
2. Template names are unique across the whole database, which breaks as soon as two users both want a "Frontend Developer" template.
3. History already knows who was emailed, but the send flow never checks it, so duplicates go out silently.
4. Status is only `sent`/`failed`, so replies cannot be measured.

## 4. Goals and non-goals

**Goals for the pilot (`[4]` weeks):**
- **G1:** `[20]` students actively sending emails through the tool.
- **G2:** Measure reply rate per template.
- **G3:** Zero accidental duplicate emails.

**Non-goals for v2:**
- Open or click tracking. Tracking pixels hurt deliverability and are unreliable because of mail privacy features.
- Reading the user's inbox to detect replies automatically. This needs a Google "restricted" permission and a paid security assessment (see section 9).
- Email providers other than Gmail.
- AI-written emails.
- A mobile app.

## 5. Target users

**Primary:** final-year students and recent graduates doing off-campus job or internship outreach.
- Use Gmail.
- Send roughly `[10-50]` cold emails a week during placement season.
- Many are non-technical, so the product must need **zero setup**: no installs, no App Passwords, no config files.

> **TODO (research):** refine this profile from interviews (year, branch, emails per week, current tools such as Gmail, Sheets, mail-merge add-ons).

## 6. Success metrics

| Metric | Definition | Pilot target |
|---|---|---|
| **North star: weekly active senders** | Users with at least 1 successful send in the week | `[15]` by week 3 |
| Reply rate | Emails marked Replied, Interview or Rejected ÷ emails sent, per user and per template | Baseline in week 1, then track the trend |
| Activation | % of sign-ups who send their first email within 24 hours | `[60%]` |
| Guardrail: send failure rate | Failed sends ÷ attempted sends | Below 2% |
| Guardrail: duplicate sends | Emails to an address contacted in the last 30 days, sent without the user choosing "Send anyway" | 0 |
| Follow-up rate (Phase 2) | Follow-ups sent ÷ follow-up reminders that came due | `[50%]` |

## 7. Prioritisation (RICE, provisional)

Reach = pilot users affected per month (pilot of 20). Impact: 3 massive, 2 high, 1 medium, 0.5 low. Effort = person-weeks (provisional; engineering to re-estimate).

| Feature | Reach | Impact | Confidence | Effort | RICE score |
|---|---|---|---|---|---|
| US-04 Duplicate warning | 20 | 1 | 80% | 0.5 | **32** |
| US-06 Mark outcome | 20 | 2 | 80% | 1 | **32** |
| US-01 to 03 Sign-in, own Gmail, private data | 20 | 3 | 80% | 3 | **16** |
| US-05 Daily sending limit | 20 | 0.5 | 80% | 0.5 | **16** |
| US-07 Follow-up reminders | 15 | 2 | 50% | 2 | **7.5** |
| US-08 CSV bulk import | 8 | 2 | 50% | 3 | **2.7** |

**Notes:**
- US-01 to 03 score lower than US-04, but they are a **prerequisite**: without them no one except the installer can use the product. They ship first regardless of score.
- US-06 ships in Phase 1 because the reply-rate metric needs outcome data from the first day of the pilot.
- US-08 has low confidence. Build it only if the pilot shows demand.

> **TODO (research):** update Reach and Confidence with interview results.

## 8. User stories and acceptance criteria

### Epic A: Accounts and sending (Phase 1)

**US-01: Sign in with Google** `P0`
> As a student, I want to sign in with my Google account, so that I can use the tool without installing anything.

Acceptance criteria:
1. The landing page shows a "Sign in with Google" button. There is no other sign-up method.
2. On first sign-in, an account is created and the 6 starter templates are copied into that user's account.
3. `{{senderName}}` defaults to the name on the Google account. The user can change it in Settings.
4. The user stays signed in for `[30]` days on the same browser and can sign out from any page.

**US-02: Send from my own Gmail** `P0`
> As a student, I want my emails to go out from my own Gmail address, so that HR replies reach my own inbox.

Acceptance criteria:
1. The user grants Gmail "send email" permission through Google's consent screen. The product never asks for a Gmail password or App Password.
2. The email's "From" shows the user's name and Gmail address, and the email appears in the user's Gmail "Sent" folder.
3. If permission is revoked or has expired, Send is blocked with a "Reconnect Gmail" prompt, and the filled-in form is not lost.
4. A user who has not granted permission can still view and edit templates.

**US-03: My data is private** `P0`
> As a student, I want my templates, resumes and history to be visible only to me.

Acceptance criteria:
1. Every template, resume and history record belongs to exactly one user.
2. Requesting another user's record by its ID returns "not found" (404), never the data.
3. Template names are unique per user, not across all users.
4. "Delete my account" permanently removes the user's templates, resumes, history and stored Google tokens.

### Epic B: Safe sending (Phase 1)

**US-04: Duplicate-recipient warning** `P0`
> As a student, I want a warning before I email an HR I have already contacted, so that I don't look careless or spammy.

Acceptance criteria:
1. Before sending, if the recipient address (trimmed, case-insensitive) has a **successful** send in the user's history within the last `[30]` days, a warning shows the previous send date, company and template.
2. The user can choose "Send anyway" or "Cancel". "Send anyway" is recorded in History.
3. Previous **failed** sends do not trigger the warning.
4. The check covers all of the user's templates, not only the selected one.

**US-05: Daily sending limit** `P0`
> As the product owner, I want a per-user daily sending limit, so that users' Gmail accounts don't get flagged for spam and the tool is not used for mass mailing.

Acceptance criteria:
1. Default limit is `[50]` successful sends per user per day, resetting at midnight IST. The limit is configurable by the admin without a code change.
2. When the limit is reached, Send is disabled with a message saying when it resets.
3. Once the user is within `[10]` sends of the limit, the number of sends left today is shown next to the Send button.

**US-06: Mark the outcome of an email** `P0`
> As a student, I want to mark what happened after I sent an email, so that I can see which templates actually get replies.

Acceptance criteria:
1. Every successful send in History has an outcome: **No response** (default), **Replied**, **Interview** or **Rejected**.
2. The user can change the outcome in one click from History.
3. History can be filtered by outcome and by template.
4. History shows reply rate per template: (Replied + Interview + Rejected) ÷ sent.
5. Templates with fewer than `[5]` sends show "Not enough data" instead of a rate.

### Epic C: Follow-ups (Phase 2)

**US-07: Follow-up reminders** `P1`
> As a student, I want to be reminded to follow up when an HR hasn't replied, so that good leads don't go cold.

Acceptance criteria:
1. When sending, the user can pick "Remind me to follow up in 3 / 5 / 7 days" (default `[5]`) or "No reminder".
2. A "Follow-ups due" list shows emails whose reminder date has passed and whose outcome is still No response. The number of due follow-ups is shown as a badge after sign-in.
3. Changing the outcome to Replied, Interview or Rejected removes the email from the list.
4. "Send follow-up" opens a follow-up template pre-filled with the same HR and company. The follow-up should appear in the same Gmail conversation as the original. If engineering finds this is not possible with send-only permission, send it as a new email with subject "Re: _original subject_".
5. Follow-ups count toward the daily limit and appear in History linked to the original email.
6. Reminders are in-app only for the pilot (no email or push notifications).

### Epic D: Bulk sending (Phase 3)

**US-08: Import HR contacts from CSV** `P2`
> As a student with a list of HR contacts, I want to upload a CSV and send a personalised email to each contact, so that I don't fill the form 30 times.

Acceptance criteria:
1. Accepts a `.csv` file with a header row and columns `hrName`, `companyName`, `email`. Maximum `[100]` rows per file. A sample CSV can be downloaded from the upload screen.
2. Before anything is sent, a review table flags invalid emails, missing fields and duplicates (inside the file and against History, as in US-04). The user can remove rows.
3. The first email is shown fully rendered as a preview.
4. Emails are sent one at a time with a gap of `[30-60]` seconds. If the daily limit would be exceeded, the user is told how many will go today; the rest stay as "Not sent" and can be resumed on a later day.
5. Each row shows its status (queued, sent, or failed with reason). The user can cancel the rest of the queue at any time.
6. Sending continues if the user closes the browser tab.

## 9. Notes and constraints for engineering

Engineering owns the technical design. These are constraints the product owner is aware of:

**Sending method.** Recommended: Google sign-in with the Gmail API's send-only permission (`gmail.send` scope), instead of App Passwords. Reasons:
- Non-technical users struggle to create App Passwords. It needs 2-Step Verification, and the page shows "not available for your account" on some accounts; we hit this ourselves while setting up v1.
- Storing App Passwords means storing credentials that unlock the user's entire Google account.

**Google verification.** `gmail.send` is a Google "sensitive" scope. Until the app passes Google's OAuth verification it stays in Testing mode, which means:
- A maximum of 100 test users, each added by email in Google Cloud Console.
- Users see an "unverified app" warning on the consent screen.
- Sign-in tokens expire after 7 days, so users must reconnect weekly (US-02 AC 3 covers this).

This is acceptable for the pilot. Start verification in parallel if we plan to grow past 100 users. _Confirm the current Google policy before starting._

**Why reply tracking is manual.** Detecting replies automatically needs inbox-reading scopes (such as `gmail.readonly` or `gmail.metadata`). Google classes these as "restricted", which requires an annual third-party security assessment. US-06 avoids this.

**Security.**
- Google tokens are encrypted at rest, never logged and never sent to the browser.
- Every API route returns only the signed-in user's data (US-03).

**Data model changes (from the v1 code):**
- New `User` collection: Google ID, email, name, sender name, encrypted Google token, created date.
- `Template`: add `userId`. Replace the global unique index on `name` with a unique index on (`userId`, `name`).
- `EmailLog`: add `userId`, `outcome` (default `no_response`), `outcomeUpdatedAt`, `followUpAt`, `parentLogId` (links a follow-up to its original), Gmail message/thread ID, and a `sentAnyway` flag (US-04).
- The global `RESUME_PATH` becomes a per-user "default resume" uploaded in Settings (PDF, max 2 MB, same validation as v1).
- Starter templates are seeded per user on first sign-in, not once per database.

**Hosting.** v1 already has `vercel.json`, and the MongoDB Atlas free tier is enough for the pilot. The CSV queue (US-08) needs background processing that keeps running after the request ends; serverless functions may time out, so engineering should pick a suitable option before Phase 3.

## 10. Analytics events

Stored in MongoDB for the pilot. No third-party analytics tool.

| Event | Fired when | Properties |
|---|---|---|
| `signed_up` | First sign-in | none |
| `gmail_connected` | Send permission granted | none |
| `email_sent` | Successful send | template ID, is follow-up, source (form or CSV) |
| `email_failed` | Send failed | template ID, error type |
| `duplicate_warning_shown` | US-04 warning displayed | none |
| `duplicate_send_anyway` | User chose "Send anyway" | none |
| `outcome_marked` | Outcome changed | from, to, days since sent |
| `followup_reminder_set` | Reminder chosen while sending | days |
| `csv_import_completed` | CSV queue finished or cancelled | rows, sent, failed, skipped |

## 11. Release plan

| Phase | Scope | Exit criteria |
|---|---|---|
| **1. Pilot-ready** | US-01 to US-06 | `[5]` internal testers each send 10+ real emails with no blocking bugs. Then invite pilot users |
| **Pilot** | `[20]` students for `[4]` weeks | Weekly 10-minute check-in with `[5]` users; metrics from section 6 reviewed weekly |
| **2. Follow-ups** | US-07 | Starts after 2 weeks of pilot data |
| **3. Bulk CSV** | US-08 | Only if at least `[40%]` of pilot users ask for it |

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Users hesitate to give Gmail permission | Ask only for send permission. Explain on the sign-in page that the app can send but cannot read their inbox |
| Emails land in spam | Daily limit, gaps between bulk sends, plain email style, no tracking pixels |
| Weekly reconnect (Testing mode) causes drop-off | Clear reconnect prompt that keeps the form (US-02 AC 3); start Google verification early |
| Tool is misused for spam | Daily limit, every user tied to a Google identity, terms of use |
| Users don't mark outcomes, so reply-rate data is incomplete | Consider a nudge on History for emails older than 5 days still marked No response; validate in check-ins |

## 13. Dependencies and open questions

**Dependencies:**
- **Permission from Aman Bhaskar.** The v1 repository has no license file, so by default all rights stay with the author. Get his written OK before deploying a modified public version.
- Google Cloud project with OAuth consent screen set up.
- MongoDB Atlas and hosting accounts.

**Open questions:**
1. Is 5 days the right default follow-up gap? _(Ask in interviews.)_
2. Is 50 per day the right sending limit?
3. Should "Rejected" count toward reply rate? _(Proposed: yes, because the HR did respond.)_
4. Who pays for hosting if the pilot outgrows free tiers?

## Appendix: v1 code map

| File | What it does |
|---|---|
| `server/index.js` | Express app, MongoDB connection, seeding, `/api/config` |
| `server/routes/email.js` | `POST /api/send` (send and log), `GET /api/history` |
| `server/routes/templates.js` | Template CRUD and per-template resume upload |
| `server/models/Template.js`, `EmailLog.js` | Database schemas |
| `server/utils/mailer.js` | Nodemailer Gmail transport (to be replaced by the Gmail API) |
| `server/utils/resume.js` | Global resume loader (file path or Drive link) |
| `server/utils/render.js` | Placeholder filling and plain-text-to-HTML |
| `client/src/components/SendForm.jsx` | Send form and live preview |
| `client/src/components/TemplateManager.jsx` | Template editor |
| `client/src/components/HistoryModal.jsx` | History view |
