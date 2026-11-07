import nodemailer from 'nodemailer';

const url = process.env.SMTP_URL;
const transport = url ? nodemailer.createTransport(url) : null;

export const emailConfigured = !!transport;

export async function sendEmail(msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
  images: { cid: string; content: Buffer }[];
}) {
  if (!transport) throw new Error('Email is not configured. Set SMTP_URL in .env.');
  await transport.sendMail({
    from: process.env.MAIL_FROM ?? 'Chatboat <digests@chatboat.local>',
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    attachments: msg.images.map(i => ({ filename: `${i.cid}.png`, content: i.content, cid: i.cid })),
  });
}
