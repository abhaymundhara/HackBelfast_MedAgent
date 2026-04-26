"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!email || !password) {
      setErr("Enter email and password.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      router.push("/portal/dashboard");
    }, 600);
  };

  return (
    <div className="portal-login-wrap">
      <div className="portal-card portal-login">
        <div className="portal-brand">
          <span className="mark">M</span>
          <span>MedAgent Portal</span>
        </div>
        <div className="portal-eyebrow">Secure access</div>
        <h1 className="portal-title">Sign in to your portal</h1>
        <p className="portal-sub">
          Mock authentication for demo. Any email and password unlock the
          dashboard.
        </p>

        <form onSubmit={onSubmit}>
          <div className="portal-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="patient@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="portal-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {err && <div className="portal-error">{err}</div>}
          <button className="portal-btn" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Continue to dashboard"}
          </button>
        </form>

        <div className="portal-hint">demo · no real credentials checked</div>
      </div>
    </div>
  );
}
