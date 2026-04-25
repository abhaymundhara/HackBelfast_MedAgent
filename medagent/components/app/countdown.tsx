"use client";

import { useEffect, useState } from "react";

export function Countdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState("");
  const [urgency, setUrgency] = useState<"normal" | "warning" | "expired">("normal");

  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Session ended");
        setUrgency("expired");
        return;
      }
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000)
        .toString()
        .padStart(2, "0");
      setRemaining(`${minutes}m ${seconds}s`);
      setUrgency(minutes < 5 ? "warning" : "normal");
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  if (urgency === "expired") {
    return (
      <div className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
        Session ended — access has been revoked and logged
      </div>
    );
  }

  if (urgency === "warning") {
    return (
      <div className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-700 animate-pulse">
        Expires in {remaining} — data will no longer be accessible
      </div>
    );
  }

  return (
    <div className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
      Expires in {remaining}
    </div>
  );
}
