import Link from "next/link";
import { Fragment } from "react";

import { SolanaStatusAlert } from "@/components/app/solana-status-alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAuditEvents } from "@/lib/db";
import { getSolscanSlotUrl, getSolscanTxUrl } from "@/lib/solana/client";

export const dynamic = "force-dynamic";

type AuditViewRow = {
  key: string;
  chainTimestamp: string;
  requesterHash: string;
  decision: "allow" | "deny" | null;
  eventType: string;
  txUrl: string | null;
  slotUrl: string | null;
  chainRef: string;
  chainSequence: number | null;
  patientHash: string;
  jurisdiction: string;
  tokenExpiry: string | null;
};

function shortenSignature(signature: string) {
  if (signature.length <= 18) {
    return signature;
  }
  return `${signature.slice(0, 8)}…${signature.slice(-8)}`;
}

const deterministicDateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

function formatDeterministicDate(value: string | null | undefined) {
  if (!value) return "n/a";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "n/a";
  return `${deterministicDateFormatter.format(parsed)} UTC`;
}

function toViewRows(patientId: string): AuditViewRow[] {
  const events = listAuditEvents(patientId);

  // Defensive guard: listAuditEvents is expected to be synchronous.
  const eventsUnknown: unknown = events;
  if (
    eventsUnknown !== null &&
    typeof eventsUnknown === "object" &&
    "then" in eventsUnknown
  ) {
    throw new Error("listAuditEvents returned a Promise; expected sync array");
  }

  return events.map((row) => ({
    key: row.id,
    chainTimestamp: row.chainTimestamp,
    requesterHash: row.doctorHash,
    decision: row.decision,
    eventType: row.eventType,
    txUrl: row.chainRef.startsWith("local-solana:")
      ? null
      : getSolscanTxUrl(row.chainRef),
    slotUrl:
      row.chainRef.startsWith("local-solana:") ||
      typeof row.chainSequence !== "number"
        ? null
        : getSolscanSlotUrl(row.chainSequence),
    chainRef: row.chainRef,
    chainSequence: row.chainSequence,
    patientHash: row.patientHash,
    jurisdiction: row.jurisdiction,
    tokenExpiry: row.tokenExpiry,
  }));
}

export default async function AuditPage({
  params,
}: {
  params: { patientId: string };
}) {
  const rows = toViewRows(params.patientId).sort(
    (a, b) =>
      new Date(b.chainTimestamp).getTime() -
      new Date(a.chainTimestamp).getTime(),
  );

  return (
    <main className="container max-w-4xl space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Access log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every access decision is recorded with non-PHI metadata.
        </p>
      </div>
      <SolanaStatusAlert />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Decision</TableHead>
            <TableHead>Slot</TableHead>
            <TableHead>Tx</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row) => (
              <Fragment key={row.key}>
                <TableRow>
                  <TableCell className="font-mono text-sm tabular-nums">
                    {formatDeterministicDate(row.chainTimestamp)}
                  </TableCell>
                  <TableCell className="text-sm">{row.eventType}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs ${
                        row.decision === "allow"
                          ? "text-green-700"
                          : row.decision === "deny"
                            ? "text-red-600"
                            : "text-amber-600"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          row.decision === "allow"
                            ? "bg-green-500"
                            : row.decision === "deny"
                              ? "bg-red-500"
                              : "bg-amber-500"
                        }`}
                      />
                      {row.decision === "allow"
                        ? "Allowed"
                        : row.decision === "deny"
                          ? "Denied"
                          : "N/A"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {row.slotUrl ? (
                      <Link
                        href={row.slotUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sm text-primary underline-offset-4 hover:underline"
                      >
                        {row.chainSequence}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">n/a</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.txUrl ? (
                      <Link
                        href={row.txUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sm text-primary underline-offset-4 hover:underline"
                        title={row.chainRef}
                      >
                        {shortenSignature(row.chainRef)}
                      </Link>
                    ) : (
                      <span className="text-xs text-amber-700">
                        Local fallback
                      </span>
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <details>
                      <summary className="cursor-pointer px-4 py-2 text-xs text-muted-foreground hover:text-foreground">
                        Details
                      </summary>
                      <div className="px-4 pb-3 text-xs text-muted-foreground space-y-1">
                        <p className="font-mono truncate">
                          <span className="font-sans font-medium text-foreground">
                            Requester hash:
                          </span>{" "}
                          {row.requesterHash}
                        </p>
                        <p className="font-mono truncate">
                          <span className="font-sans font-medium text-foreground">
                            Patient hash:
                          </span>{" "}
                          {row.patientHash}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">
                            Jurisdiction:
                          </span>{" "}
                          {row.jurisdiction}
                        </p>
                        <p className="font-mono truncate">
                          <span className="font-sans font-medium text-foreground">
                            Transaction signature:
                          </span>{" "}
                          {row.txUrl ? (
                            <Link
                              href={row.txUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {row.chainRef}
                            </Link>
                          ) : (
                            row.chainRef
                          )}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">
                            Slot:
                          </span>{" "}
                          {row.slotUrl &&
                          typeof row.chainSequence === "number" ? (
                            <Link
                              href={row.slotUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-primary underline-offset-4 hover:underline"
                            >
                              {row.chainSequence}
                            </Link>
                          ) : (
                            (row.chainSequence ?? "n/a")
                          )}
                        </p>
                        {row.tokenExpiry ? (
                          <p>
                            <span className="font-medium text-foreground">
                              Token expiry:
                            </span>{" "}
                            {formatDeterministicDate(row.tokenExpiry)}
                          </p>
                        ) : null}
                      </div>
                    </details>
                  </TableCell>
                </TableRow>
              </Fragment>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-12 text-center text-muted-foreground"
              >
                No access events recorded yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </main>
  );
}
