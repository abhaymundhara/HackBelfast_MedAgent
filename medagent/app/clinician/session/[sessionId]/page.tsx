"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { Countdown } from "@/components/app/countdown";
import { SessionFollowUp } from "@/components/app/session-follow-up";

type SessionData = {
  id: string;
  requestId: string;
  patientId: string;
  requesterId: string;
  tier: number;
  expiresAt: string;
  brief: string;
  fieldsAllowed: string[];
  chainRef: string | null;
  chainSequence: number | null;
  chainTimestamp: string | null;
  createdAt: string;
};

const FIELD_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  demographics: { label: "Demographics", icon: "👤", color: "bg-blue-50 text-blue-700 border-blue-200" },
  allergies: { label: "Allergies", icon: "⚠️", color: "bg-red-50 text-red-700 border-red-200" },
  medications: { label: "Medications", icon: "💊", color: "bg-purple-50 text-purple-700 border-purple-200" },
  conditions: { label: "Conditions", icon: "🩺", color: "bg-amber-50 text-amber-700 border-amber-200" },
  alerts: { label: "Active Alerts", icon: "🚨", color: "bg-red-50 text-red-700 border-red-200" },
  emergency_contact: { label: "Emergency Contact", icon: "📞", color: "bg-green-50 text-green-700 border-green-200" },
  recent_discharge: { label: "Recent Discharge", icon: "🏥", color: "bg-slate-50 text-slate-700 border-slate-200" },
  documents: { label: "Documents", icon: "📄", color: "bg-slate-50 text-slate-700 border-slate-200" },
};

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Tier 1 — Full Emergency Access", color: "bg-green-100 text-green-800 border-green-300" },
  2: { label: "Tier 2 — Patient Approved", color: "bg-blue-100 text-blue-800 border-blue-300" },
  3: { label: "Tier 3 — Limited Access", color: "bg-amber-100 text-amber-800 border-amber-300" },
};

export default function ClinicianSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/access/session/${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Session not found or expired");
        return res.json();
      })
      .then((data) => setSession(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading authorized session...</p>
        </div>
      </main>
    );
  }

  if (error || !session) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3 max-w-md">
          <div className="mx-auto h-12 w-12 rounded-full bg-red-50 flex items-center justify-center text-2xl">
            🔒
          </div>
          <h1 className="text-xl font-semibold">Session unavailable</h1>
          <p className="text-sm text-muted-foreground">
            {error ?? "This session may have expired or does not exist."}
          </p>
          <Link
            href="/doctor/dashboard"
            className="inline-block mt-2 text-sm text-primary underline-offset-4 hover:underline"
          >
            Return to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const tier = TIER_LABELS[session.tier] ?? TIER_LABELS[1];
  const isExpired = new Date(session.expiresAt).getTime() < Date.now();

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${tier.color}`}>
                {tier.label}
              </span>
              {session.chainRef && !session.chainRef.startsWith("local-") && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  Verified on Solana
                </span>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Emergency Medical Brief
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Patient: {session.patientId} &middot; Session {session.id.slice(0, 8)}
            </p>
          </div>
          <Countdown expiresAt={session.expiresAt} />
        </div>

        {/* Medical Brief */}
        {!isExpired && (
          <>
            <section className="rounded-2xl border border-red-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-red-100 bg-red-50 px-6 py-3">
                <h2 className="text-sm font-semibold text-red-800 uppercase tracking-wide">
                  Clinical Summary
                </h2>
              </div>
              <div className="px-6 py-5">
                <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">
                  {session.brief || "No brief available for this session."}
                </div>
              </div>
            </section>

            {/* Authorized Fields */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Authorized Data Fields
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {session.fieldsAllowed.map((field) => {
                  const meta = FIELD_LABELS[field] ?? {
                    label: field.replace(/_/g, " "),
                    icon: "📋",
                    color: "bg-slate-50 text-slate-700 border-slate-200",
                  };
                  return (
                    <div
                      key={field}
                      className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${meta.color}`}
                    >
                      <span className="text-base">{meta.icon}</span>
                      <span className="capitalize">{meta.label}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Audit Proof */}
            {session.chainRef && (
              <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                <div className="border-b bg-slate-50 px-6 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                    Blockchain Audit Record
                  </h2>
                </div>
                <div className="px-6 py-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase">Transaction</span>
                    <p className="mt-1 font-mono text-xs truncate">
                      {session.chainRef.startsWith("local-") ? (
                        <span className="text-amber-600">Pending on-chain confirmation</span>
                      ) : (
                        <a
                          href={`https://solscan.io/tx/${session.chainRef}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {session.chainRef}
                        </a>
                      )}
                    </p>
                  </div>
                  {typeof session.chainSequence === "number" && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase">Slot</span>
                      <p className="mt-1 font-mono text-xs">
                        <a
                          href={`https://solscan.io/block/${session.chainSequence}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {session.chainSequence}
                        </a>
                      </p>
                    </div>
                  )}
                  {session.chainTimestamp && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase">Recorded</span>
                      <p className="mt-1 text-xs text-slate-600">
                        {new Date(session.chainTimestamp).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Follow-up Q&A */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Ask a Follow-up Question
              </h2>
              <p className="text-xs text-muted-foreground">
                Questions are answered strictly within your authorized data scope. All queries are audited.
              </p>
              <SessionFollowUp
                sessionId={session.id}
                suggestedQuestions={[
                  "What is the highest-priority allergy risk?",
                  "Are any current medications contraindicated?",
                  "Summarize the most recent discharge",
                ]}
              />
            </section>
          </>
        )}

        {/* Footer Links */}
        <div className="flex flex-wrap gap-3 border-t pt-6">
          <Link
            href={`/audit/${session.patientId}`}
            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            View full audit trail
          </Link>
          <Link
            href="/doctor/dashboard"
            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
