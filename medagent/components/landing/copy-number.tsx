"use client";

import { useState } from "react";

type Props = {
  value: string;
  className?: string;
  children: React.ReactNode;
};

export function CopyNumberButton({ value, className, children }: Props) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className={className} onClick={onClick}>
      {copied ? "✓ Copied" : children}
    </button>
  );
}
