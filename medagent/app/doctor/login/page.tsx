"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type Step = "lookup" | "otp_sent" | "verify";

export default function DoctorLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("lookup");
  const [regNumber, setRegNumber] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [regBody, setRegBody] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devOtp, setDevOtp] = useState("");

  async function handleLookup() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regNumber: regNumber.trim() }),
      });
      const data = await res.json();
      if (!data.found) {
        setError("Registration number not found. Please check and try again.");
        return;
      }
      setDoctorName(data.name);
      setMaskedEmail(data.email);
      setRegBody(data.regBody);
      setStep("otp_sent");
    } catch {
      setError("Failed to look up registration number.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regNumber: regNumber.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send verification code.");
        return;
      }
      if (data.devOtp) {
        setDevOtp(data.devOtp);
      }
      setStep("verify");
    } catch {
      setError("Failed to send verification code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regNumber: regNumber.trim(), code: otpCode.trim() }),
      });
      const data = await res.json();
      if (!data.verified) {
        setError(data.error ?? "Invalid verification code.");
        return;
      }
      document.cookie = `doctor_token=${data.jwt}; path=/; max-age=${4 * 60 * 60}; samesite=strict`;
      router.push("/doctor/dashboard");
    } catch {
      setError("Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Doctor Login</h1>
          <p className="text-sm text-muted-foreground">
            Verify your identity with your IMC or GMC registration number
          </p>
        </div>

        <div className="border rounded-xl p-6 space-y-4 bg-white shadow-sm">
          {step === "lookup" && (
            <>
              <label className="block text-sm font-medium text-slate-700">
                Registration Number
              </label>
              <input
                type="text"
                placeholder="e.g. MC12345 or GMC7953798"
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              />
              <Button
                onClick={handleLookup}
                disabled={loading || !regNumber.trim()}
                className="w-full"
              >
                {loading ? "Looking up..." : "Look up"}
              </Button>
            </>
          )}

          {step === "otp_sent" && (
            <>
              <div className="rounded-lg bg-slate-50 p-4 space-y-1">
                <p className="text-sm font-medium text-slate-900">{doctorName}</p>
                <p className="text-xs text-slate-500">
                  {regBody} &middot; {regNumber}
                </p>
                <p className="text-xs text-slate-500">
                  OTP will be sent to {maskedEmail}
                </p>
              </div>
              <Button
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Sending..." : "Send verification code"}
              </Button>
              <button
                onClick={() => setStep("lookup")}
                className="w-full text-sm text-slate-500 hover:text-slate-700"
              >
                Use a different registration number
              </button>
            </>
          )}

          {step === "verify" && (
            <>
              <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
                Verification code sent to {maskedEmail}
              </div>
              {devOtp && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  <span className="font-semibold">Demo mode:</span> Your code is{" "}
                  <span className="font-mono font-bold tracking-widest">{devOtp}</span>
                </div>
              )}
              <label className="block text-sm font-medium text-slate-700">
                Enter 6-digit code
              </label>
              <input
                type="text"
                placeholder="000000"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              />
              <Button
                onClick={handleVerify}
                disabled={loading || otpCode.length !== 6}
                className="w-full"
              >
                {loading ? "Verifying..." : "Verify"}
              </Button>
              <button
                onClick={handleSendOtp}
                className="w-full text-sm text-slate-500 hover:text-slate-700"
              >
                Resend code
              </button>
            </>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
