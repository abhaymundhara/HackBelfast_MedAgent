"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { TextMedAgentButton } from "@/components/landing/text-medagent-button";

const links = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/features", label: "Features" },
  { href: "/use-cases", label: "Use cases" },
];

const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link href="/" className="brand">
          <span className="mark">M</span>
          <span>MedAgent</span>
        </Link>
        <nav className="nav-links">
          {links.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`nav-link${active ? " active" : ""}`}
              >
                {label}
              </Link>
            );
          })}
          <TextMedAgentButton className="btn btn-primary">
            Text MedAgent
            <ArrowRight />
          </TextMedAgentButton>
        </nav>
      </div>
    </header>
  );
}
