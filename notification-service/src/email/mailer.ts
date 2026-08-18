import nodemailer from "nodemailer";
import { env } from "../config/env";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  // Mailpit (the local dev SMTP catcher) accepts unauthenticated, unencrypted
  // connections — a real provider in production would need auth/TLS options
  // added here, driven by env vars the same way host/port already are.
  secure: false,
});

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function sendEmail(input: SendEmailInput): Promise<void> {
  return transporter
    .sendMail({
      from: env.SMTP_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    })
    .then(() => undefined);
}
