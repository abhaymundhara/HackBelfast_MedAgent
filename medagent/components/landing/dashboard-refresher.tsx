"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

type Props = {
  intervalMs?: number;
};

type DashboardVersionResponse = {
  version?: string;
};

export function DashboardRefresher({ intervalMs = 1000 }: Props) {
  const router = useRouter();
  const versionRef = useRef<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    if (document.visibilityState !== "visible") return;

    try {
      const response = await fetch("/api/patient/dashboard/version", {
        cache: "no-store",
      });
      if (!response.ok) return;

      const payload = (await response.json()) as DashboardVersionResponse;
      if (!payload.version) return;

      if (versionRef.current === null) {
        versionRef.current = payload.version;
        return;
      }

      if (versionRef.current !== payload.version) {
        versionRef.current = payload.version;
        router.refresh();
      }
    } catch {
      // Keep the dashboard usable if a transient poll fails.
    }
  }, [router]);

  useEffect(() => {
    void checkForUpdates();
    const id = window.setInterval(() => {
      void checkForUpdates();
    }, intervalMs);

    const onFocus = () => {
      void checkForUpdates();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkForUpdates, intervalMs]);

  return null;
}
