"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Props = {
  intervalMs?: number;
};

export function DashboardRefresher({ intervalMs = 8000 }: Props) {
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, intervalMs);

    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [router, intervalMs]);

  return null;
}
