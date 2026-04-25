import { getSmsQrDataUrl } from "@/lib/qr";

export async function QrCard() {
  const dataUrl = await getSmsQrDataUrl();
  return (
    <div className="qr-card" aria-hidden="true">
      <div className="qr-img-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt="" width={200} height={200} />
      </div>
      <div className="cap">Scan to open in Messages</div>
    </div>
  );
}
