import 'server-only';

import nodemailer from 'nodemailer';

function readPort() {
  const p = Number(process.env.SMTP_PORT || 587);
  return Number.isFinite(p) ? p : 587;
}

function smtpEnabled() {
  return Boolean(
    String(process.env.SMTP_HOST || '').trim() &&
      String(process.env.SMTP_USER || '').trim() &&
      String(process.env.SMTP_PASS || '').trim() &&
      String(process.env.SMTP_FROM || '').trim(),
  );
}

export async function sendSmtpMail(input: { to: string; subject: string; text: string; html?: string }) {
  if (!smtpEnabled()) {
    throw new Error('SMTP chưa cấu hình đầy đủ (SMTP_HOST/PORT/USER/PASS/FROM).');
  }
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = readPort();
  const secure = String(process.env.SMTP_SECURE || '').trim().toLowerCase() === 'true' || port === 465;
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const from = String(process.env.SMTP_FROM || '').trim();
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
