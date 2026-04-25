"use client";

import { useEffect, useRef } from "react";

import { getSmsHref } from "@/lib/contactPhone";

type Props = {
  className?: string;
  children: React.ReactNode;
  qrAnchorId?: string;
};

const FALLBACK_DELAY_MS = 1500;

export function TextMedAgentButton({
  className,
  children,
  qrAnchorId = "qr",
}: Props) {
  const href = getSmsHref();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const scrollToQr = () => {
    const target = document.getElementById(qrAnchorId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.location.href = `/#${qrAnchorId}`;
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    let leftPage = false;
    const markLeft = () => {
      if (document.hidden) leftPage = true;
    };
    const onBlur = () => {
      leftPage = true;
    };

    document.addEventListener("visibilitychange", markLeft);
    window.addEventListener("blur", onBlur);

    try {
      window.location.href = href;
    } catch {
      // Some browsers throw when no handler is registered
    }

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      document.removeEventListener("visibilitychange", markLeft);
      window.removeEventListener("blur", onBlur);
      timerRef.current = null;
      if (!leftPage && !document.hidden) {
        scrollToQr();
      }
    }, FALLBACK_DELAY_MS);
  };

  return (
    <a className={className} href={href} onClick={handleClick}>
      {children}
    </a>
  );
}
