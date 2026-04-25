import crypto from "crypto";

import jwt from "jsonwebtoken";

import { getDb } from "@/lib/db";

const SESSION_TTL_HOURS = 4;

function getSessionSecret(): string {
  return process.env.DOCTOR_SESSION_SECRET ?? "medagent-doctor-session-secret-dev";
}

export function createDoctorSession(
  regNumber: string,
  name: string,
): { sessionId: string; jwt: string; expiresAt: string } {
  const db = getDb();
  const sessionId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  const token = jwt.sign(
    { sub: regNumber, name, sessionId },
    getSessionSecret(),
    { expiresIn: `${SESSION_TTL_HOURS}h` },
  );

  db.prepare(
    `INSERT INTO doctor_sessions (id, reg_number, name, jwt, created_at, expires_at)
     VALUES (@id, @regNumber, @name, @jwt, @createdAt, @expiresAt)`,
  ).run({
    id: sessionId,
    regNumber,
    name,
    jwt: token,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  return { sessionId, jwt: token, expiresAt: expiresAt.toISOString() };
}

export function validateDoctorSession(
  token: string,
): { valid: boolean; regNumber?: string; name?: string } {
  try {
    const decoded = jwt.verify(token, getSessionSecret()) as {
      sub: string;
      name: string;
      sessionId: string;
    };
    return { valid: true, regNumber: decoded.sub, name: decoded.name };
  } catch {
    return { valid: false };
  }
}
