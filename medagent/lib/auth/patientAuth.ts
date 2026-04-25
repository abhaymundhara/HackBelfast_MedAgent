import crypto from "crypto";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { getDb } from "@/lib/db";

function getPatientSessionSecret() {
  return (
    process.env.PATIENT_SESSION_SECRET ??
    process.env.DOCTOR_SESSION_SECRET ??
    "medagent-patient-session-secret-dev"
  );
}
const SESSION_TTL_HOURS = 24;

export async function registerPatient(input: {
  email: string;
  phone?: string;
  password: string;
  patientId: string;
}): Promise<{ accountId: string; jwt: string }> {
  const db = getDb();
  const accountId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(input.password, 10);
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO patient_accounts (id, patient_id, email, phone, password_hash, created_at)
     VALUES (@id, @patientId, @email, @phone, @passwordHash, @createdAt)`,
  ).run({
    id: accountId,
    patientId: input.patientId,
    email: input.email,
    phone: input.phone ?? null,
    passwordHash,
    createdAt: now,
  });

  const token = jwt.sign(
    { sub: input.patientId, accountId, role: "patient" },
    getPatientSessionSecret(),
    { expiresIn: `${SESSION_TTL_HOURS}h` },
  );

  return { accountId, jwt: token };
}

export async function loginPatient(
  email: string,
  password: string,
): Promise<{ jwt: string; patientId: string } | null> {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM patient_accounts WHERE email = ?")
    .get(email) as
    | { id: string; patient_id: string; password_hash: string }
    | undefined;

  if (!row) {
    return null;
  }

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    return null;
  }

  db.prepare(
    "UPDATE patient_accounts SET last_login_at = ? WHERE id = ?",
  ).run(new Date().toISOString(), row.id);

  const token = jwt.sign(
    { sub: row.patient_id, accountId: row.id, role: "patient" },
    getPatientSessionSecret(),
    { expiresIn: `${SESSION_TTL_HOURS}h` },
  );

  return { jwt: token, patientId: row.patient_id };
}

export function validatePatientJwt(
  token: string,
): { valid: boolean; patientId?: string } {
  try {
    const decoded = jwt.verify(token, getPatientSessionSecret()) as {
      sub: string;
      role: string;
    };
    if (decoded.role !== "patient") {
      return { valid: false };
    }
    return { valid: true, patientId: decoded.sub };
  } catch {
    return { valid: false };
  }
}
