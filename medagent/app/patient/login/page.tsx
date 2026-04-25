"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export default function PatientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/patient/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed.");
        return;
      }
      document.cookie = `patient_token=${data.jwt}; path=/; max-age=${24 * 60 * 60}; samesite=strict`;
      router.push("/patient/dashboard");
    } catch {
      setError("Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Patient Login
          </h1>
          <p className="text-sm text-muted-foreground">
            Access your medical interaction dashboard
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border rounded-xl p-6 space-y-4 bg-white shadow-sm"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Logging in..." : "Log in"}
          </Button>

          <p className="text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <a
              href="/patient/register"
              className="text-blue-600 hover:underline"
            >
              Register
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}
