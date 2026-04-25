"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { TierBadge } from "@/components/app/tier-badge";
import { WorkflowSteps } from "@/components/app/workflow-steps";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DEMO_CLINICIANS } from "@/lib/ips/seed";
import { RequestIntent } from "@/lib/types";

type PatientOption = {
  patientId: string;
  name: string;
};

type WaitingState = {
  requestId: string;
  requesterId: string;
  requesterLabel: string;
  patientId: string;
  patientName: string;
  status: "awaiting_approval" | "approved_resuming" | "denied" | "expired";
  justification: string | null;
  requestIntent: RequestIntent | null;
} | null;

export function ClinicianConsole({ patients }: { patients: PatientOption[] }) {
  const router = useRouter();
  const [requesterId, setRequesterId] = useState(DEMO_CLINICIANS[0].requesterId);
  const [patientId, setPatientId] = useState(patients[0]?.patientId ?? "sarah-bennett");
  const [naturalLanguageRequest, setNaturalLanguageRequest] = useState(
    "Patient collapsed during travel. Need immediate medication and allergy context for emergency care.",
  );
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState<WaitingState>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activePersona = DEMO_CLINICIANS.find(
    (persona) => persona.requesterId === requesterId,
  );
  const selectedPatient = patients.find((p) => p.patientId === patientId);

  // Poll for approval when in waiting state
  useEffect(() => {
    if (!waiting) return;
    if (waiting.status === "denied" || waiting.status === "expired") return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/access/request/${waiting.requestId}`);
        const payload = await res.json();
        if (payload.sessionId) {
          if (pollRef.current) clearInterval(pollRef.current);
          setWaiting(null);
          router.push(`/clinician/session/${payload.sessionId}`);
          return;
        }

        if (
          payload.status === "awaiting_approval" ||
          payload.status === "approved_resuming" ||
          payload.status === "denied" ||
          payload.status === "expired"
        ) {
          setWaiting((current) =>
            current
              ? {
                  ...current,
                  status: payload.status,
                  justification: payload.justification ?? current.justification,
                }
              : current,
          );

          if (payload.status === "denied" || payload.status === "expired") {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }
      } catch {
        // silently retry on next interval
      }
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [waiting, router]);

  async function submitRequest() {
    setBusy(true);
    setMessage(null);
    setWaiting(null);
    const response = await fetch("/api/access/request", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        patientId,
        requesterId,
        naturalLanguageRequest,
        emergencyMode,
      }),
    });
    const payload = await response.json();
    setBusy(false);

    if (payload.sessionId) {
      router.push(`/clinician/session/${payload.sessionId}`);
      return;
    }

    if (payload.decision === "awaiting_human") {
      setWaiting({
        requestId: payload.requestId,
        requesterId,
        requesterLabel: activePersona?.requesterLabel ?? requesterId,
        patientId,
        patientName: selectedPatient?.name ?? patientId,
        status: "awaiting_approval",
        justification: payload.justification ?? null,
        requestIntent: payload.requestIntent ?? null,
      });
    } else {
      setMessage(payload.justification ?? "Access denied.");
    }
  }

  const waitingTitle =
    waiting?.status === "approved_resuming"
      ? "Approval received. Resuming MedAgent workflow"
      : waiting?.status === "denied"
        ? "Patient denied this request"
        : waiting?.status === "expired"
          ? "Approval window expired"
          : "Waiting for patient approval";

  const waitingTone =
    waiting?.status === "approved_resuming"
      ? "border-green-200 bg-green-50/70"
      : waiting?.status === "denied" || waiting?.status === "expired"
        ? "border-red-200 bg-red-50/70"
        : "border-tier2/30 bg-amber-50/60";

  if (waiting) {
    return (
      <div className={`rounded-2xl border p-6 space-y-5 ${waitingTone}`}>
        <div className="flex items-center gap-3">
          <TierBadge tier={2} />
          <h2 className="text-xl font-semibold">{waitingTitle}</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          An approval request has been sent to <span className="font-semibold text-foreground">{waiting.patientName}</span>.
          {waiting.status === "awaiting_approval"
            ? " Once they approve, you'll be redirected automatically."
            : waiting.status === "approved_resuming"
              ? " The original request is now being resumed instead of creating a duplicate."
              : ""}
        </p>
        {waiting.status === "awaiting_approval" || waiting.status === "approved_resuming" ? (
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">
              {waiting.status === "approved_resuming"
                ? "Approval detected. Waiting for the session to finish opening..."
                : "Checking for response..."}
            </span>
          </div>
        ) : null}
        <div className="text-sm text-muted-foreground space-y-1">
          <p><span className="font-medium text-foreground">Request ID:</span> {waiting.requestId}</p>
          <p><span className="font-medium text-foreground">Clinician:</span> {waiting.requesterLabel}</p>
          <p><span className="font-medium text-foreground">Patient:</span> {waiting.patientName}</p>
          <p><span className="font-medium text-foreground">Access level:</span> With patient approval - limited dataset for 15 minutes</p>
        </div>
        {waiting.requestIntent ? (
          <div className="rounded-xl border border-border/70 bg-white/70 p-4 text-sm space-y-2">
            <p className="font-medium text-foreground">Requested focus</p>
            <p className="text-muted-foreground">{waiting.requestIntent.intentSummary}</p>
            {waiting.requestIntent.priorityTopics.length ? (
              <p className="text-muted-foreground">
                Priority topics: {waiting.requestIntent.priorityTopics.join(", ")}
              </p>
            ) : null}
          </div>
        ) : null}
        {waiting.justification ? (
          <div className="rounded-xl border border-border/70 bg-white/70 p-4 text-sm text-muted-foreground">
            {waiting.justification}
          </div>
        ) : null}
        <Button
          variant="outline"
          onClick={() => {
            if (pollRef.current) clearInterval(pollRef.current);
            setWaiting(null);
          }}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-5">
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Clinician</label>
        <div className="flex items-center gap-3">
          <select
            className="h-10 w-full rounded-[10px] border-[1.5px] border-[#E2E8F0] bg-white px-3 text-sm transition-all focus:outline-none focus:ring-[3px] focus:ring-primary/12 focus:border-primary"
            value={requesterId}
            onChange={(event) => setRequesterId(event.target.value)}
          >
            {DEMO_CLINICIANS.map((persona) => (
              <option key={persona.requesterId} value={persona.requesterId}>
                {persona.requesterLabel}
              </option>
            ))}
          </select>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
            activePersona?.stronglyVerified
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}>
            {activePersona?.stronglyVerified ? "Verified ✓" : "Not verified"}
          </span>
        </div>
        {activePersona ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {activePersona.issuerLabel} -{" "}
            {activePersona.stronglyVerified
              ? "trusted registry match for Tier 1"
              : "known clinician path that still requires Tier 2 approval or Tier 3 emergency access"}
          </p>
        ) : null}
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Patient</label>
        <select
          className="h-10 w-full rounded-[10px] border-[1.5px] border-[#E2E8F0] bg-white px-3 text-sm transition-all focus:outline-none focus:ring-[3px] focus:ring-primary/12 focus:border-primary"
          value={patientId}
          onChange={(event) => setPatientId(event.target.value)}
        >
          {patients.map((patient) => (
            <option key={patient.patientId} value={patient.patientId}>
              {patient.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">
          Describe the clinical situation
        </label>
        <Textarea
          rows={4}
          value={naturalLanguageRequest}
          onChange={(event) => setNaturalLanguageRequest(event.target.value)}
          placeholder="e.g. Patient collapsed during travel. Need immediate medication and allergy context for emergency care."
        />
      </div>
      </div>
      <label className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] bg-white p-4 text-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div>
          <p className="font-medium text-foreground">Emergency override</p>
          <p className="text-xs text-muted-foreground">Patient is unconscious or unreachable</p>
        </div>
        <Switch checked={emergencyMode} onCheckedChange={setEmergencyMode} />
      </label>
      <WorkflowSteps active={busy} />
      <Button disabled={busy} onClick={submitRequest} className="w-full shadow-[0_4px_14px_rgba(13,115,119,0.3)] hover:shadow-[0_6px_20px_rgba(13,115,119,0.4)] hover:-translate-y-px">
        {busy ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Processing request...
          </span>
        ) : (
          "Request access"
        )}
      </Button>
      {message ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {message}
        </div>
      ) : null}
    </div>
  );
}
