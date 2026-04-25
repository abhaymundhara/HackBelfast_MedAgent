import QRCode from "qrcode";

import { DEFAULT_SMS_BODY, getMedAgentPhone } from "@/lib/contactPhone";

export type SmsQrOptions = {
  phone?: string;
  body?: string;
  width?: number;
};

export async function getSmsQrDataUrl({
  phone = getMedAgentPhone(),
  body = DEFAULT_SMS_BODY,
  width = 480,
}: SmsQrOptions = {}): Promise<string> {
  const target = `sms:${phone}?body=${encodeURIComponent(body)}`;
  return QRCode.toDataURL(target, {
    errorCorrectionLevel: "M",
    margin: 1,
    width,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });
}
