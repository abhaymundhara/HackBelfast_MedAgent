"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function RevokeShareButton({ shareId }: { shareId: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function revoke() {
    setBusy(true);
    const response = await fetch(`/api/share/${shareId}/revoke`, {
      method: "POST",
    });
    setBusy(false);
    if (response.ok) {
      setDone(true);
      window.location.reload();
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={busy || done}
      onClick={revoke}
    >
      {done ? "Revoked" : busy ? "Revoking..." : "Revoke"}
    </Button>
  );
}

