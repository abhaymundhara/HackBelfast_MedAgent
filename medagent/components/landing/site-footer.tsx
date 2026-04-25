import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container foot-grid">
        <div className="brand">
          <span className="mark">M</span>
          <span>MedAgent</span>
        </div>
        <div className="meta">© 2026 · Built for HackBelfast · Belfast, Northern Ireland</div>
        <div className="links">
          <Link href="/how-it-works">How it works</Link>
          <Link href="/features">Features</Link>
          <Link href="/use-cases">Use cases</Link>
        </div>
      </div>
    </footer>
  );
}
