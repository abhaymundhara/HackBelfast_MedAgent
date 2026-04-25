"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/patient", label: "Patient" },
  { href: "/doctor/login", label: "Doctor" },
  { href: "/audit/sarah-bennett", label: "Audit" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-primary">
            <path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill="currentColor"
              opacity="0.85"
            />
          </svg>
          MedAgent
        </Link>
        <div className="flex items-center gap-1">
          {links.map(({ href, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
          <div className="ml-4 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            DR
          </div>
        </div>
      </div>
    </nav>
  );
}
