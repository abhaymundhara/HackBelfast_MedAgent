import Link from "next/link";
import { notFound } from "next/navigation";

import { Countdown } from "@/components/app/countdown";
import { SessionFollowUp } from "@/components/app/session-follow-up";
import { TierBadge } from "@/components/app/tier-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { analyzeRequestIntent, sortFieldsByIntent } from "@/lib/agent/tools/analyzeRequestIntent";
import { verifyRequester } from "@/lib/agent/tools/verifyRequester";
import { getAccessRequest, getAgentTrace, getSession } from "@/lib/db";
import { ReleasedField, WITHHELD_FIELD_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

const STEP_LABELS: Record<string, string> = {
  verifyRequester: "Verified clinician identity",
  decideTier: "Determined access level",
  analyzeRequestIntent: "Interpreted clinician request",
  requestPatientApproval: "Requested patient approval",
  fetchSummary: "Retrieved emergency summary",
  translateTerms: "Translated medical terms",
  issueSessionToken: "Session created",
  logAuditOnChain: "Decision recorded to audit log",
};

const TRUST_LEVEL_LABELS: Record<string, string> = {
  trusted_requester: "Trusted requester",
  trusted_issuer_unrecognized_requester: "Trusted issuer, unrecognized requester",
  known_untrusted_issuer: "Known issuer, not trusted for Tier 1",
  credential_presented_untrusted: "Credential presented, not trusted",
  unknown_requester: "Unknown requester",
};

function humanizeStepSummary(tool: string, summary: string): string {
  // Strip SHA-256 hashes
  let cleaned = summary.replace(/sha256:[a-f0-9]{64}/gi, "").trim();
  // Strip raw UUIDs
  cleaned = cleaned.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, "").trim();
  // Strip ISO timestamps
  cleaned = cleaned.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g, "").trim();
  // Strip JWT fragments
  cleaned = cleaned.replace(/eyJ[A-Za-z0-9_-]+\.?/g, "").trim();

  // Keep Solana audit status explicit so operators can distinguish local vs on-chain records.
  if (tool === "logAuditOnChain" && /missing|skipped/i.test(cleaned)) {
    return "Audit write was skipped (offline or missing Solana config). Decision is local only.";
  }

  if (tool === "logAuditOnChain" && /failed/i.test(cleaned)) {
    return "Audit write to Solana failed. Decision is stored locally only.";
  }

  if (tool === "issueSessionToken") {
    const match = summary.match(/expiring at (\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    if (match) {
      const date = new Date(match[1]);
      return `Session authorised at ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return "Time-limited session created and authorised.";
  }

  // Clean up trailing punctuation artifacts
  cleaned = cleaned.replace(/\s{2,}/g, " ").replace(/[.,]\s*$/, "").trim();
  return cleaned || STEP_LABELS[tool] || summary;
}

export default async function ClinicianSessionPage({ params }: { params: { id: string } }) {
  const session = getSession(params.id);
  if (!session) {
    notFound();
  }
  const request = getAccessRequest(session.request_id);
  const trace = getAgentTrace(session.request_id);
  const verification = request
    ? await verifyRequester({
        requesterId: request.requester_id,
        presentedCredential: request.presented_credential ?? undefined,
      })
    : null;
  const requestIntent = request
    ? analyzeRequestIntent({
        naturalLanguageRequest: request.natural_language_request,
        fieldsAllowed: session.fieldsAllowed as ReleasedField[],
      })
    : null;
  const released = requestIntent
    ? sortFieldsByIntent(session.fieldsAllowed as ReleasedField[], requestIntent)
    : session.fieldsAllowed;
  const withheld = Object.entries(WITHHELD_FIELD_LABELS)
    .filter(([field]) => !released.includes(field))
    .map(([, label]) => label);

  return (
    <main className="container max-w-3xl space-y-8 py-10">
      {/* Header: tier + countdown + requester on one line */}
      <div className="flex flex-wrap items-center gap-3">
        <TierBadge tier={session.tier as 1 | 2 | 3} decision="granted" />
        <Countdown expiresAt={session.expires_at} />
        <span className="text-sm text-muted-foreground ml-auto">
          {request?.requester_label} &middot; {request?.issuer_label}
        </span>
      </div>

      {/* Primary content: the clinician brief */}
      <section>
        <h1 className="text-2xl font-semibold tracking-tight mb-4">Emergency summary</h1>
        <div className="whitespace-pre-line text-sm leading-7 text-foreground">
          {session.brief}
        </div>
      </section>

      {requestIntent ? (
        <section className="rounded-2xl border border-primary/15 bg-primary/5 p-5 text-sm space-y-3">
          <div>
            <h2 className="font-semibold text-foreground">Clinical intent</h2>
            <p className="mt-1 text-muted-foreground">{requestIntent.intentSummary}</p>
          </div>
          {requestIntent.priorityTopics.length ? (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Priority topics:</span>{" "}
              {requestIntent.priorityTopics.join(", ")}
            </p>
          ) : null}
          {requestIntent.withheldRequestedFields.length ? (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Requested but withheld:</span>{" "}
              {requestIntent.withheldRequestedFields
                .map((field) => WITHHELD_FIELD_LABELS[field])
                .join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}

      {verification ? (
        <section className="rounded-2xl border border-border bg-card p-5 text-sm space-y-2">
          <h2 className="font-semibold text-foreground">Verification basis</h2>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Trust outcome:</span>{" "}
            {TRUST_LEVEL_LABELS[verification.trustLevel] ?? verification.trustLevel}
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Requester:</span> {verification.requesterLabel}
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Issuer:</span> {verification.issuerLabel}
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Registry anchored:</span>{" "}
            {verification.registryAnchored ? "Yes" : "No"}
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Verification mode:</span>{" "}
            {verification.verificationMode}
          </p>
          <p className="text-muted-foreground">{verification.verificationReason}</p>
        </section>
      ) : null}

      {/* Released / Withheld inline */}
      <section className="flex flex-wrap gap-6 text-sm border-t border-border pt-6">
        <div>
          <p className="font-medium text-foreground mb-2">Released</p>
          <ul className="space-y-1 text-muted-foreground">
            {released.map((field) => (
              <li key={field} className="flex items-center gap-1.5">
                <span className="text-green-600">&#10003;</span>
                {WITHHELD_FIELD_LABELS[field as keyof typeof WITHHELD_FIELD_LABELS]}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-medium text-foreground mb-2">Withheld</p>
          <ul className="space-y-1 text-muted-foreground">
            {withheld.length ? withheld.map((field) => (
              <li key={field} className="flex items-center gap-1.5">
                <span className="text-red-400">&#10005;</span>
                {field}
              </li>
            )) : <li className="text-muted-foreground">None — full access granted</li>}
          </ul>
        </div>
      </section>

      {/* Collapsible sections */}
      <div className="space-y-3 border-t border-border pt-6">
        {session.glossary.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-foreground hover:text-primary">
              Glossary
            </summary>
            <div className="mt-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Original</TableHead>
                    <TableHead>Translated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session.glossary.map((entry) => (
                    <TableRow key={`${entry.original}-${entry.translated}`}>
                      <TableCell>{entry.original}</TableCell>
                      <TableCell>{entry.translated}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </details>
        )}

        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-foreground hover:text-primary">
            Workflow steps
          </summary>
          <div className="mt-3">
            <p className="mb-3 text-xs text-muted-foreground">
              Each step was executed automatically. Access levels are determined by policy rules, not by AI judgment.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Step</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trace?.steps.map((step) => (
                  <TableRow key={`${step.order}-${step.tool}`}>
                    <TableCell className="font-medium">{STEP_LABELS[step.tool] ?? step.tool}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 text-xs ${
                        step.status === "completed" ? "text-green-700" :
                        step.status === "failed" ? "text-red-600" :
                        "text-amber-600"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          step.status === "completed" ? "bg-green-500" :
                          step.status === "failed" ? "bg-red-500" :
                          "bg-amber-500"
                        }`} />
                        {step.status === "completed" ? "Done" :
                         step.status === "failed" ? "Failed" :
                         step.status === "running" ? "Running" : step.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{humanizeStepSummary(step.tool, step.summary)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>

        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-foreground hover:text-primary">
            Follow-up questions
          </summary>
          <div className="mt-3">
            <p className="mb-3 text-xs text-muted-foreground">
              Ask questions about the authorized data. Answers are limited to the dataset released for this session.
            </p>
            <SessionFollowUp
              sessionId={session.id}
              suggestedQuestions={requestIntent?.suggestedQuestions ?? []}
            />
          </div>
        </details>

        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-foreground hover:text-primary">
            Audit details
          </summary>
          <div className="mt-3 space-y-2 text-xs text-muted-foreground font-mono">
            <p>Session: {session.id}</p>
            <p>Chain ref: {session.chain_ref ?? request?.chain_ref ?? "pending"}</p>
            <p>Slot: {session.chain_sequence ?? request?.chain_sequence ?? "n/a"}</p>
            {(request?.chain_ref) ? (
              <Link
                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline text-xs font-sans"
                href={`/audit/${session.patient_id}`}
              >
                View full audit log &rarr;
              </Link>
            ) : null}
          </div>
        </details>
      </div>
    </main>
  );
}
