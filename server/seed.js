import Template from './models/Template.js';

// Starter templates. Edit them from the "Manage Templates" screen in the app.
// Placeholders: {{hrName}}, {{companyName}}, {{senderName}}
const defaults = [
  {
    name: 'Frontend Developer',
    subject: 'Application for Frontend Developer role at {{companyName}}',
    body: `Hi {{hrName}},

I hope you are doing well. I am writing to express my interest in a Frontend Developer role at {{companyName}}.

I work mainly with React, JavaScript/TypeScript, HTML and CSS, and I enjoy building fast, accessible and pixel-perfect user interfaces. I would love the opportunity to contribute to the product experience at {{companyName}}.

I have attached my resume for your reference. I would be grateful if you could consider my profile for any suitable openings.

Thank you for your time.

Best regards,
{{senderName}}`,
  },
  {
    name: 'Backend Developer',
    subject: 'Application for Backend Developer role at {{companyName}}',
    body: `Hi {{hrName}},

I hope you are doing well. I am reaching out to express my interest in a Backend Developer role at {{companyName}}.

I have hands-on experience with Node.js, Express, MongoDB and REST API design, and I care about writing clean, scalable and well-tested services.

Please find my resume attached. I would really appreciate it if you could consider me for any relevant openings at {{companyName}}.

Thank you for your time.

Best regards,
{{senderName}}`,
  },
  {
    name: 'Full Stack Developer',
    subject: 'Application for Full Stack Developer role at {{companyName}}',
    body: `Hi {{hrName}},

I hope you are doing well. I am writing to apply for a Full Stack Developer role at {{companyName}}.

I build end-to-end applications with the MERN stack (MongoDB, Express, React, Node.js), from designing APIs and databases to shipping responsive frontends.

I have attached my resume for your review and would be glad to discuss how I can contribute to {{companyName}}.

Thank you for your time.

Best regards,
{{senderName}}`,
  },
  {
    name: 'SDE',
    subject: 'Application for Software Development Engineer role at {{companyName}}',
    body: `Hi {{hrName}},

I hope you are doing well. I am interested in a Software Development Engineer position at {{companyName}}.

I have a strong foundation in data structures, algorithms and problem solving, along with project experience in full stack development.

My resume is attached for your reference. I would be grateful if you could consider my profile for any SDE openings at {{companyName}}.

Thank you for your time.

Best regards,
{{senderName}}`,
  },
  {
    name: 'Internship',
    subject: 'Internship application – {{companyName}}',
    body: `Hi {{hrName}},

I hope you are doing well. I am writing to ask about internship opportunities in software development at {{companyName}}.

I am eager to learn, contribute and grow with your team. My resume is attached for your reference.

Thank you for considering my application.

Best regards,
{{senderName}}`,
  },
  {
    name: 'Referral Request',
    subject: 'Referral request for opportunities at {{companyName}}',
    body: `Hi {{hrName}},

I hope you are doing well. I came across {{companyName}} and I am very interested in the work your team is doing.

I wanted to ask if you could refer me or point me to the right person for any open software engineering roles. I have attached my resume for your reference.

Thanks a lot for your time and help.

Best regards,
{{senderName}}`,
  },
  {
    // Used by "Send follow-up". The subject is replaced with "Re: <original subject>" when sending.
    name: 'Follow-up',
    subject: 'Following up on my application at {{companyName}}',
    body: `Hi {{hrName}},

I hope you are doing well. I wanted to follow up on my previous email about opportunities at {{companyName}}.

I am still very interested and would be grateful for any update, or for a pointer to the right person to speak with.

Thank you for your time.

Best regards,
{{senderName}}`,
  },
];

// Every new user gets their own copy of the starter templates on first sign-in.
export async function seedTemplatesForUser(userId) {
  await Template.insertMany(defaults.map((t) => ({ ...t, userId })));
}
