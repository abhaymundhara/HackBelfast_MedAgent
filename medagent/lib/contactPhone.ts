export const DEFAULT_MEDAGENT_PHONE = "+447387381555";
export const DEFAULT_SMS_BODY = "Hey Baymax!";

export function getMedAgentPhone(): string {
  const fromEnv = process.env.NEXT_PUBLIC_MEDAGENT_PHONE?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_MEDAGENT_PHONE;
}

export function getSmsHref(body: string = DEFAULT_SMS_BODY, phone: string = getMedAgentPhone()): string {
  return `sms:${phone}?body=${encodeURIComponent(body)}`;
}
