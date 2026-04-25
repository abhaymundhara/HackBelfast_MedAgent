"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type PendingApproval = {
  approvalId: string;
  requestId: string;
  token: string;
  method: "push" | "email";
  status: string;
  sentAt: string;
  expiresAt: string;
  requesterLabel: string | null;
  issuerLabel: string | null;
  naturalLanguageRequest: string;
};

export function ApprovalControls({
  approvals,
  patientName,
}: {
  approvals: PendingApproval[];
  patientName?: string;
}) {
  const [busyToken, setBusyToken] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, "approved" | "denied">>({});

  async function handleDecision(approval: PendingApproval, approved: boolean) {
    setBusyToken(approval.token);
    await fetch("/api/access/approve", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        requestId: approval.requestId,
        approvalToken: approval.token,
        approved,
      }),
    });

    setBusyToken(null);
    setDecisions((prev) => ({
      ...prev,
      [approval.approvalId]: approved ? "approved" : "denied",
    }));
  }

  if (!approvals.length) {
    return <p className="text-sm text-muted-foreground">No pending requests. You&apos;re all set.</p>;
  }

  return (
    <div className="space-y-4">
      {approvals.map((approval) => {
        const decision = decisions[approval.approvalId];

        if (decision === "approved") {
          return (
            <div
              key={approval.approvalId}
              className="rounded-2xl border border-green-200 bg-green-50 p-4"
            >
              <p className="text-sm font-semibold text-green-800">
                Access approved for {approval.requesterLabel}
              </p>
              <p className="mt-1 text-sm text-green-700">
                {approval.requesterLabel} from {approval.issuerLabel} now has limited access to your
                emergency information for 15 minutes. The audit record will show blockchain status once processed.
              </p>
            </div>
          );
        }

        if (decision === "denied") {
          return (
            <div
              key={approval.approvalId}
              className="rounded-2xl border border-red-200 bg-red-50 p-4"
            >
              <p className="text-sm font-semibold text-red-800">
                Access denied for {approval.requesterLabel}
              </p>
              <p className="mt-1 text-sm text-red-700">
                {approval.requesterLabel} will not be able to see your records. The audit record will show blockchain status once processed.
              </p>
            </div>
          );
        }

        return (
          <div
            key={approval.approvalId}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  {approval.requesterLabel} from {approval.issuerLabel}
                </p>
                <p className="text-sm text-muted-foreground">
                  &ldquo;{approval.naturalLanguageRequest}&rdquo;
                </p>
                <p className="text-xs text-muted-foreground">
                  If you approve, they&apos;ll see your medications, allergies, key conditions, and
                  alerts for 15 minutes. They will <span className="font-medium">not</span> see your
                  full medical history.
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  disabled={busyToken === approval.token}
                  onClick={() => handleDecision(approval, true)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyToken === approval.token}
                  onClick={() => handleDecision(approval, false)}
                >
                  Deny
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
