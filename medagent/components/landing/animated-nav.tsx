"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useScroll, useTransform } from "framer-motion";

const links = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/features", label: "Features" },
  { href: "/use-cases", label: "Use cases" },
];

const SMS_HREF = "sms:+447700900099?body=Emergency%20access%20request";

const ArrowRight = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export function AnimatedNav() {
  const pathname = usePathname();
  const { scrollY } = useScroll();

  const bgOpacity = useTransform(scrollY, [0, 100], [0, 0.85]);
  const backdropBlur = useTransform(scrollY, [0, 100], [0, 16]);
  const borderOpacity = useTransform(scrollY, [0, 100], [0, 0.1]);

  const bg = useTransform(bgOpacity, (v) => `rgba(10, 10, 10, ${v})`);
  const blur = useTransform(backdropBlur, (v) => `blur(${v}px)`);
  const border = useTransform(borderOpacity, (v) => `1px solid rgba(255,255,255,${v})`);

  return (
    <motion.header
      className="nav"
      style={{
        backgroundColor: bg,
        backdropFilter: blur,
        borderBottom: border,
      }}
    >
      <div className="container nav-inner">
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Link href="/" className="brand">
            <span className="mark">M</span>
            <span>MedAgent</span>
          </Link>
        </motion.div>
        <nav className="nav-links">
          {links.map(({ href, label }, i) => {
            const active =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <motion.div
                key={href}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
              >
                <Link
                  href={href}
                  className={`nav-link${active ? " active" : ""}`}
                >
                  {label}
                </Link>
              </motion.div>
            );
          })}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <Link className="btn btn-primary" href={SMS_HREF}>
              Text MedAgent
              <ArrowRight />
            </Link>
          </motion.div>
        </nav>
      </div>
    </motion.header>
  );
}
