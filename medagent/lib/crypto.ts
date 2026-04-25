import crypto from "crypto";

const DEFAULT_DEV_PEPPER =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function getPepper() {
  return process.env.ENCRYPTION_PEPPER || DEFAULT_DEV_PEPPER;
}

function deriveKey() {
  return crypto.scryptSync(getPepper(), "medagent-aes-256-gcm", 32);
}

export function encryptBuffer(input: Buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

export function decryptBuffer(payload: Buffer) {
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function encryptString(value: string) {
  return encryptBuffer(Buffer.from(value, "utf8")).toString("base64");
}

export function decryptString(value: string) {
  return decryptBuffer(Buffer.from(value, "base64")).toString("utf8");
}

export function encryptJson<T>(value: T) {
  return encryptString(JSON.stringify(value));
}

export function decryptJson<T>(value: string) {
  return JSON.parse(decryptString(value)) as T;
}

export function sha256Hash(value: Buffer | string) {
  const hash = crypto.createHash("sha256").update(value).digest("hex");
  return `sha256:${hash}`;
}

export function sha256Json(value: unknown) {
  return sha256Hash(JSON.stringify(value));
}
