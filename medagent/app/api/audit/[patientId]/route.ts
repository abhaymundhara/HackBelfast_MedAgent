import { NextResponse } from "next/server";

import { listAuditEvents } from "@/lib/db";
import { getSolscanSlotUrl, getSolscanTxUrl } from "@/lib/solana/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { patientId: string } },
) {
  try {
    const rows = listAuditEvents(params.patientId);
    const enrichedRows = rows.map((row) => {
      const chainRef = row.chainRef ?? "";
      const isLocalFallback = chainRef.startsWith("local-solana:");
      const txUrl =
        !isLocalFallback && chainRef ? getSolscanTxUrl(chainRef) : null;
      const slotUrl =
        !isLocalFallback && chainRef && typeof row.chainSequence === "number"
          ? getSolscanSlotUrl(row.chainSequence)
          : null;

      return {
        ...row,
        txUrl,
        slotUrl,
      };
    });

    const txExamples = enrichedRows
      .filter((row) => row.txUrl)
      .slice(0, 3)
      .map((row) => ({
        chainRef: row.chainRef,
        txUrl: row.txUrl,
        slot: row.chainSequence,
        slotUrl: row.slotUrl,
      }));

    return NextResponse.json({
      patientId: params.patientId,
      rows: enrichedRows,
      txExamples,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Audit query failed",
        patientId: params.patientId,
        rows: [],
      },
      { status: 500 },
    );
  }
}
