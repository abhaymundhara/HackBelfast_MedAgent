import nodemailer from "nodemailer";

let cachedTransport: nodemailer.Transporter | null = null;

export function getMailTransport(): nodemailer.Transporter | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) return null;

  if (!cachedTransport) {
    cachedTransport = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }

  return cachedTransport;
}

export function getFromAddress(): string {
  return process.env.GMAIL_USER
    ? `MedAgent <${process.env.GMAIL_USER}>`
    : "MedAgent <noreply@medagent.dev>";
}
