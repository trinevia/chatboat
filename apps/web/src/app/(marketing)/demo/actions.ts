'use server';

import nodemailer from 'nodemailer';

export interface DemoFormState {
  ok: boolean;
  message: string;
  errors?: Partial<Record<'name' | 'email' | 'company', string>>;
}

const clip = (v: FormDataEntryValue | null, max: number) => String(v ?? '').trim().slice(0, max);

/** "Book a demo": validates the form and emails it to the sales inbox via SMTP_URL. */
export async function requestDemo(_prev: DemoFormState, formData: FormData): Promise<DemoFormState> {
  // Honeypot: real people never fill this hidden field.
  if (clip(formData.get('website'), 200)) return { ok: true, message: 'Thanks! We will be in touch shortly.' };

  const data = {
    name: clip(formData.get('name'), 120),
    email: clip(formData.get('email'), 200),
    company: clip(formData.get('company'), 160),
    teamSize: clip(formData.get('teamSize'), 40),
    dataSources: clip(formData.get('dataSources'), 300),
    message: clip(formData.get('message'), 4000),
    topic: clip(formData.get('topic'), 40),
  };
  const errors: DemoFormState['errors'] = {};
  if (!data.name) errors.name = 'Please tell us your name';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Please enter a valid work email';
  if (!data.company) errors.company = 'Please tell us your company';
  if (Object.keys(errors).length) return { ok: false, message: 'Please fix the highlighted fields.', errors };

  const smtpUrl = process.env.SMTP_URL;
  if (!smtpUrl) {
    console.error('[demo] SMTP_URL is not set; demo request not sent', data.email);
    return { ok: false, message: 'Sorry, we could not send your request right now. Please email us instead.' };
  }

  const to = process.env.DEMO_REQUEST_TO || 'sales@chatboat.ai';
  const from = process.env.MAIL_FROM || 'Chatboat <no-reply@chatboat.ai>';
  const lines = [
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Company: ${data.company}`,
    `Team size: ${data.teamSize || '—'}`,
    `Data sources: ${data.dataSources || '—'}`,
    data.topic ? `Topic: ${data.topic}` : null,
    '',
    data.message || '(no message)',
  ].filter((l) => l !== null);

  try {
    await nodemailer.createTransport(smtpUrl).sendMail({
      from,
      to,
      replyTo: `${data.name.replace(/[<>"]/g, '')} <${data.email}>`,
      subject: `Demo request: ${data.company}`,
      text: lines.join('\n'),
    });
  } catch (err) {
    console.error('[demo] sending failed', err);
    return { ok: false, message: 'Sorry, we could not send your request right now. Please try again in a minute.' };
  }
  return { ok: true, message: `Thanks, ${data.name.split(' ')[0]}! We will email ${data.email} within one working day to find a time.` };
}
