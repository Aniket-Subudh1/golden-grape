import nodemailer, { type Transporter } from 'nodemailer';
import type { ReactElement } from 'react';
import { env, smtpConfigured } from './env';

let transport: Transporter | undefined;

// Created on first send so a missing SMTP config never breaks the build or the boot.
const getTransport = () =>
  (transport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  }));

type Mail = { to: string; subject: string; html: string; text: string; replyTo?: string };

/** Sends through SMTP, or logs the mail when SMTP is not configured (local dev, tests). */
export async function sendMail(mail: Mail) {
  if (!smtpConfigured()) {
    console.info(`[mail] SMTP not configured, not sent: "${mail.subject}" → ${mail.to}`);
    return;
  }
  await getTransport().sendMail({ from: env.MAIL_FROM, ...mail });
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&nbsp;': ' ' };

/** Renders an e-mail template to HTML plus a plain-text version. */
export async function render(template: ReactElement) {
  // Loaded lazily: react-dom/server is only needed when a mail is actually built.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const body = renderToStaticMarkup(template);
  const text = body
    .replace(/<head[\s\S]*?<\/head>/i, '') // the <style> of the layout is not text
    .replace(/<(br|\/p|\/tr|\/h[1-6]|\/div)[^>]*>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' ') // "Référence CMD-…", not "RéférenceCMD-…"
    .replace(/<[^>]+>/g, '')
    .replace(/&[#\w]+;/g, (e) => ENTITIES[e] ?? e)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { html: `<!doctype html>${body}`, text };
}
