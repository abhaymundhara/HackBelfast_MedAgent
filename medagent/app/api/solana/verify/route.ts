import { NextRequest, NextResponse } from "next/server";

import { getSolanaConnection, isSolanaConfigured } from "@/lib/solana/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const chainRef = body.chainRef as string | undefined;

    if (!chainRef || typeof chainRef !== "string") {
      return NextResponse.json(
        { error: "chainRef is required" },
        { status: 400 },
      );
    }

    if (chainRef.startsWith("local-solana:")) {
      return NextResponse.json({
        verified: false,
        status: "local_only",
        message: "This event was recorded locally without on-chain submission.",
      });
    }

    if (!isSolanaConfigured()) {
      return NextResponse.json({
        verified: false,
        status: "not_configured",
        message: "Solana is not configured. Cannot verify on-chain.",
      });
    }

    const connection = getSolanaConnection();
    const tx = await connection.getTransaction(chainRef, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return NextResponse.json({
        verified: false,
        status: "not_found",
        message: "Transaction not found on Solana. It may have expired or the cluster may differ.",
      });
    }

    return NextResponse.json({
      verified: true,
      status: "confirmed",
      slot: tx.slot,
      blockTime: tx.blockTime
        ? new Date(tx.blockTime * 1000).toISOString()
        : null,
      fee: tx.meta?.fee ?? null,
      message: "Transaction confirmed on Solana.",
    });
  } catch (error) {
    console.error("Solana verify error:", error);
    return NextResponse.json(
      {
        verified: false,
        status: "error",
        message: error instanceof Error ? error.message : "Verification failed",
      },
      { status: 500 },
    );
  }
}
