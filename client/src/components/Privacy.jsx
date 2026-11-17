// Public page (no sign-in needed). Its URL goes into Google Cloud → Branding → Privacy policy.
const CONTACT = import.meta.env.VITE_CONTACT_EMAIL;

export default function Privacy() {
  return (
    <div className="page">
      <div className="card">
        <div className="card-head">
          <h2>Privacy Policy</h2>
          <p>Mail Automator · Last updated 17 November 2026</p>
        </div>
        <div className="card-body legal">
          <p>
            Mail Automator helps job seekers send personalised application emails to HR contacts from their own
            Gmail account. This page explains what data the app uses and why.
          </p>

          <h3>Data we get from your Google account</h3>
          <ul>
            <li>
              <strong>Basic profile</strong> (name, email address, profile picture): to create your account and
              show who is signed in.
            </li>
            <li>
              <strong>Permission to send email</strong> (<code>gmail.send</code>): to send the emails you compose
              in the app, from your Gmail address. The app <strong>cannot read, search or delete</strong> anything
              in your inbox.
            </li>
          </ul>

          <h3>Data we store</h3>
          <ul>
            <li>Your name, email address and profile picture.</li>
            <li>Your email templates and any resume PDFs you upload.</li>
            <li>
              A history of emails sent through the app: HR name, company, recipient address, subject, date, status
              and the outcome you mark (for example "Replied").
            </li>
            <li>Contacts you upload in a CSV for bulk sending.</li>
            <li>
              A Google access token, stored encrypted, so the app can send the emails you schedule. It is never
              shown to anyone.
            </li>
          </ul>

          <h3>How we use it</h3>
          <p>
            Only to provide the app's features to you: sending your emails, warning you about duplicates, reminding
            you to follow up and showing your reply statistics. We do not sell your data, show ads, or share it with
            anyone. Your data is not used to train AI models.
          </p>
          <p>
            Mail Automator's use and transfer of information received from Google APIs adheres to the{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>

          <h3>Where it is stored</h3>
          <p>
            In a MongoDB database hosted by MongoDB Atlas. The app runs on Render and Vercel. Data is sent over
            HTTPS.
          </p>

          <h3>Deleting your data</h3>
          <p>
            Open <strong>Settings → Delete my account</strong>. This permanently deletes your templates, resumes,
            history and contacts, and revokes the app's access to your Google account. You can also remove access at
            any time from{' '}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
              myaccount.google.com/permissions
            </a>
            .
          </p>

          <h3>Contact</h3>
          <p>
            Questions about this policy:{' '}
            {CONTACT ? <a href={`mailto:${CONTACT}`}>{CONTACT}</a> : 'the developer email shown on the Google sign-in screen'}.
          </p>

          <p className="back-link">
            <a href="/">← Back to Mail Automator</a>
          </p>
        </div>
      </div>
    </div>
  );
}
