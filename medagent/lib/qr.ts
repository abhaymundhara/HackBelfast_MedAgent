import QRCode from "qrcode";

export type SmsQrOptions = {
  phone?: string;
  body?: string;
  width?: number;
};

export async function getSmsQrDataUrl({
  phone = "+447700900099",
  body = "Emergency access request",
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
