"use client";

import { useEffect, useState } from "react";

export function RevokeShareButton({ shareId }: { shareId: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    setToken(params.get("token"));
  }, []);

  async function revoke() {
    setBusy(true);
    const response = await fetch(`/api/share/${shareId}/revoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setBusy(false);
    if (response.ok) {
      setDone(true);
      window.location.reload();
    }
  }

  return (
    <button
      type="button"
      disabled={busy || done}
      onClick={revoke}
      className="revoke-btn"
    >
      {done ? "Revoked" : busy ? "Revoking..." : "Revoke Access"}
    </button>
  );
}
