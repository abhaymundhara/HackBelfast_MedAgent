import crypto from "crypto";

import { getDb } from "@/lib/db";

export function generateOtp(): string {
  const num = crypto.randomInt(0, 1_000_000);
  return num.toString().padStart(6, "0");
}

export async function sendOtp(
  email: string,
  otp: string,
  doctorName: string,
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@medagent.dev";

  if (!apiKey) {
    console.warn("RESEND_API_KEY not configured — OTP not sent via email");
    console.log(`[DEV] OTP for ${doctorName} (${email}): ${otp}`);
    return { sent: true };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "MedAgent — Your verification code",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>MedAgent Verification</h2>
          <p>Hello ${doctorName},</p>
          <p>Your one-time verification code is:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background: #f1f5f9; border-radius: 8px; margin: 16px 0;">
            ${otp}
          </div>
          <p>This code expires in <strong>5 minutes</strong>.</p>
          <p style="color: #64748b; font-size: 13px;">If you did not request this code, please ignore this email.</p>
        </div>
      `,
    });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to send OTP via Resend:", message);
    return { sent: false, error: message };
  }
}

export function createOtpRecord(
  regNumber: string,
  email: string,
  otp: string,
): string {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

  db.prepare(
    `INSERT INTO doctor_otps (id, reg_number, otp_code, email, created_at, expires_at, verified)
     VALUES (@id, @regNumber, @otpCode, @email, @createdAt, @expiresAt, 0)`,
  ).run({
    id,
    regNumber,
    otpCode: otp,
    email,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  return id;
}

export function verifyOtp(
  regNumber: string,
  code: string,
): { valid: boolean; error?: string } {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM doctor_otps
       WHERE reg_number = ? AND otp_code = ? AND verified = 0
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(regNumber, code) as
    | { id: string; expires_at: string; verified: number }
    | undefined;

  if (!row) {
    return { valid: false, error: "Invalid verification code" };
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return { valid: false, error: "Verification code has expired" };
  }

  db.prepare("UPDATE doctor_otps SET verified = 1 WHERE id = ?").run(row.id);

  return { valid: true };
}

export function countRecentOtps(regNumber: string): number {
  const db = getDb();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const result = db
    .prepare(
      "SELECT COUNT(*) as count FROM doctor_otps WHERE reg_number = ? AND created_at > ?",
    )
    .get(regNumber, oneHourAgo) as { count: number };
  return result.count;
}
