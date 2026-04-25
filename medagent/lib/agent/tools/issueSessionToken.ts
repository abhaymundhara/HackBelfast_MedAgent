import crypto from "crypto";

import jwt from "jsonwebtoken";

import { SessionTokenResult } from "@/lib/types";

const DEFAULT_JWT_SECRET =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

export async function issueSessionToken(input: {
  requesterId: string;
  patientId: string;
  tier: 1 | 2 | 3;
  fieldsAllowed: string[];
  ttlSeconds: number;
}): Promise<SessionTokenResult> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000).toISOString();
  const jwtToken = jwt.sign(
    {
      sub: sessionId,
      requesterId: input.requesterId,
      patientId: input.patientId,
      tier: input.tier,
      fieldsAllowed: input.fieldsAllowed,
    },
    process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
    {
      expiresIn: input.ttlSeconds,
    },
  );

  return {
    sessionId,
    jwt: jwtToken,
    expiresAt,
  };
}
