import type { EmailMessage } from './copy';

/** Structural mirror of Cloudflare's SendEmail binding, so both core and jobs can use the same mailer. */
export interface MailerMessage extends EmailMessage {
  to: string;
  from?: { email: string; name?: string };
}

interface CfSendEmail {
  // The real binding has overloads (EmailMessage | EmailMessageBuilder); we only need "callable with a plain message".
  send(message: any): Promise<unknown>;
}

export interface MailerEnv {
  RESEND_API_KEY?: string;
  EMAIL?: CfSendEmail;
  EMAIL_FROM?: string;
}

export interface Mailer {
  send(message: MailerMessage): Promise<void>;
}

/**
 * Resend first: it reaches arbitrary visitors' inboxes (sign-in OTP codes must).
 * Falls back to the CF send_email binding, which only delivers to verified destination
 * addresses — fine for the operator's own notifications, not for sign-ups.
 */
export function createMailer(env: MailerEnv, siteName: string): Mailer {
  const from = { email: env.EMAIL_FROM ?? '', name: siteName };
  return {
    async send(message: MailerMessage) {
      if (env.RESEND_API_KEY) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: `${message.from?.name ?? from.name} <${message.from?.email || from.email}>`,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html,
          }),
        });
        if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return;
      }
      if (!env.EMAIL) throw new Error('No email channel configured (set RESEND_API_KEY or bind EMAIL)');
      await env.EMAIL.send({ ...message, from: message.from ?? from });
    },
  };
}
