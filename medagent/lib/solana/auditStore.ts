import crypto from "crypto";
import fs from "fs";
import path from "path";

import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

import {
  createAuditEvent,
  getAuditEventByChainRef,
  getAuditEventByRequestAndType,
  getPendingAuditEventByKey,
  listAuditEvents as listAuditEventsFromDb,
  upsertPendingAuditEvent,
} from "@/lib/db";
import {
  getAnchorCompatibleWallet,
  getSignerKeypair,
  getSolanaCluster,
  getSolanaConnection,
  isSolanaConfigured,
} from "@/lib/solana/client";
import {
  AuditEvent,
  AuditReadinessResult,
  AuditWriteResult,
} from "@/lib/types";

const AUDIT_SEED_PREFIX = Buffer.from("medagent_audit");
const LAMPORTS_PER_SOL = 1_000_000_000;
const DEFAULT_SOL_USD = 150;
const DEFAULT_CHAIN_WRITE_COST_USD = 0.001;

type MedagentAuditIdl = {
  address: string;
};

export interface AuditStore {
  initializePatientLog(input: {
    patientHash: string;
  }): Promise<{ pda: string | null; status: "initialized" | "exists" | "skipped_missing_config" | "failed"; error?: string }>;
  writeAuditEvent(input: {
    requestId: string;
    patientId: string;
    event: AuditEvent;
  }): Promise<AuditWriteResult>;
  listAuditEvents(
    patientId: string,
  ): Promise<ReturnType<typeof listAuditEventsFromDb>>;
  readinessCheck(input?: { dryRun?: boolean }): Promise<AuditReadinessResult>;
}

function nowIso() {
  return new Date().toISOString();
}

function parseNonNegativeNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function estimateChainWriteCostUsd(chainFeeLamports: number | null) {
  if (typeof chainFeeLamports === "number" && chainFeeLamports >= 0) {
    const solUsd = parseNonNegativeNumber(
      process.env.MEDAGENT_SOL_USD,
      DEFAULT_SOL_USD,
    );
    const cost = (chainFeeLamports / LAMPORTS_PER_SOL) * solUsd;
    return Number(cost.toFixed(6));
  }

  const fallback = parseNonNegativeNumber(
    process.env.MEDAGENT_SOLANA_WRITE_COST_USD ??
      process.env.MEDAGENT_RETRIEVAL_CHAIN_WRITE_COST_USD,
    DEFAULT_CHAIN_WRITE_COST_USD,
  );
  return Number(fallback.toFixed(6));
}

function localChainRef(requestId: string) {
  return `local-solana:${requestId}:${Date.now()}`;
}

function toFixedArray(seed: Uint8Array) {
  return Array.from(seed) as number[];
}

function getIdlPath() {
  const candidates = [
    path.join(process.cwd(), "target", "idl", "medagent_audit.json"),
    path.join(process.cwd(), "..", "target", "idl", "medagent_audit.json"),
  ];

  const idlPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!idlPath) {
    throw new Error("Unable to locate target/idl/medagent_audit.json");
  }

  return idlPath;
}

function loadProgramIdAndIdl() {
  const idlPath = getIdlPath();
  const raw = fs.readFileSync(idlPath, "utf8");
  const idl = JSON.parse(raw) as MedagentAuditIdl;
  const programId = new PublicKey(idl.address);
  return { idl: JSON.parse(raw), programId };
}

function deriveAuditSeed(patientHash: string): Uint8Array {
  const bytes = Buffer.from(patientHash, "utf8");
  const seed = new Uint8Array(32);

  for (let i = 0; i < bytes.length; i += 1) {
    seed[i % 32] ^= bytes[i];
  }

  const lenBytes = Buffer.alloc(8);
  lenBytes.writeBigUInt64LE(BigInt(bytes.length));
  for (let i = 0; i < lenBytes.length; i += 1) {
    seed[24 + i] ^= lenBytes[i];
  }

  return seed;
}

function deriveAuditSeedSha256(patientHash: string): Uint8Array {
  return Uint8Array.from(
    crypto.createHash("sha256").update(patientHash, "utf8").digest(),
  );
}

function deriveAuditSeedCandidates(patientHash: string): Uint8Array[] {
  const legacy = deriveAuditSeed(patientHash);
  const sha = deriveAuditSeedSha256(patientHash);
  const seen = new Set<string>();
  const candidates: Uint8Array[] = [];

  for (const seed of [legacy, sha]) {
    const key = Buffer.from(seed).toString("hex");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    candidates.push(seed);
  }

  return candidates;
}

function buildAuditIdempotencyKey(input: {
  requestId: string;
  patientId: string;
  event: AuditEvent;
}) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        requestId: input.requestId,
        patientId: input.patientId,
        eventType: input.event.event_type,
        patientHash: input.event.patient_hash,
        doctorHash: input.event.doctor_hash,
        decision: input.event.decision,
        tokenExpiry: input.event.token_expiry,
        timestamp: input.event.timestamp,
      }),
      "utf8",
    )
    .digest("hex");
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
) {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function ensureSignerHasLamports(
  connection: ReturnType<typeof getSolanaConnection>,
  signer: NonNullable<ReturnType<typeof getSignerKeypair>>,
) {
  const cluster = getSolanaCluster();
  if (cluster !== "devnet" && cluster !== "testnet") {
    return;
  }

  const minimumLamports = 50_000_000; // 0.05 SOL
  const currentLamports = await connection.getBalance(
    signer.publicKey,
    "confirmed",
  );

  if (currentLamports >= minimumLamports) {
    return;
  }

  const topUpLamports = minimumLamports - currentLamports;
  try {
    const signature = await withTimeout(
      connection.requestAirdrop(signer.publicKey, topUpLamports),
      15_000,
      "requestAirdrop",
    );
    const latest = await withTimeout(
      connection.getLatestBlockhash("confirmed"),
      10_000,
      "getLatestBlockhash",
    );
    await withTimeout(
      connection.confirmTransaction(
        {
          signature,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        },
        "confirmed",
      ),
      20_000,
      "confirmTransaction",
    );
  } catch (error) {
    console.error("Lamport top-up failed; proceeding with current balance", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function submitViaAnchor(event: AuditEvent): Promise<AuditWriteResult> {
  const forceLocalAudit =
    process.env.MEDAGENT_FORCE_LOCAL_AUDIT === "1" ||
    process.env.MEDAGENT_FORCE_LOCAL_AUDIT === "true";
  if (forceLocalAudit) {
    return {
      chainRef: localChainRef(event.request_id),
      chainSequence: null,
      chainTimestamp: nowIso(),
      status: "skipped_missing_config",
      estimatedCostUsd: 0,
    };
  }

  const signer = getSignerKeypair();
  if (!signer) {
    return {
      chainRef: localChainRef(event.request_id),
      chainSequence: null,
      chainTimestamp: nowIso(),
      status: "skipped_missing_config",
      estimatedCostUsd: 0,
    };
  }

  const connection = getSolanaConnection();
  await ensureSignerHasLamports(connection, signer);
  const wallet = getAnchorCompatibleWallet(signer) as Wallet;
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });

  const { idl, programId } = loadProgramIdAndIdl();
  const program = new Program(idl as never, provider);

  // Anchor drives both PDA initialization and audit writes: we derive a per-patient audit-log PDA,
  // initialize it once if needed, then call `logAuditEvent` on the deployed `medagent_audit` program.

  const seedCandidates = deriveAuditSeedCandidates(event.patient_hash);
  let selectedSeed = seedCandidates[0]!;
  let auditLogPda = PublicKey.findProgramAddressSync(
    [AUDIT_SEED_PREFIX, Buffer.from(selectedSeed)],
    programId,
  )[0];
  let auditLogInfo = null as Awaited<
    ReturnType<typeof connection.getAccountInfo>
  >;

  const candidatePdas = seedCandidates.map(
    (candidateSeed) =>
      PublicKey.findProgramAddressSync(
        [AUDIT_SEED_PREFIX, Buffer.from(candidateSeed)],
        programId,
      )[0],
  );

  const candidateInfos = await connection.getMultipleAccountsInfo(
    candidatePdas,
    {
      commitment: "confirmed",
    },
  );

  for (let index = 0; index < candidateInfos.length; index += 1) {
    const info = candidateInfos[index];
    if (info) {
      selectedSeed = seedCandidates[index]!;
      auditLogPda = candidatePdas[index]!;
      auditLogInfo = info;
      break;
    }
  }

  const atomicTx = new Transaction();
  if (!auditLogInfo) {
    const initializeIx = await program.methods
      .initializeAuditLog(event.patient_hash, toFixedArray(selectedSeed))
      .accounts({
        auditLog: auditLogPda,
        authority: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    atomicTx.add(initializeIx);
  }

  const logIx = await program.methods
    .logAuditEvent({
      eventType: event.event_type,
      requestId: event.request_id,
      doctorHash: event.doctor_hash,
      patientHash: event.patient_hash,
      jurisdiction: event.jurisdiction,
      decision: event.decision,
      tokenExpiry: event.token_expiry,
      timestamp: event.timestamp,
      interactionType: event.interaction_type ?? null,
      summaryHash: event.summary_hash ?? null,
      fieldsAccessed: event.fields_accessed ?? null,
      durationSeconds: event.duration_seconds ?? null,
    })
    .accounts({
      auditLog: auditLogPda,
      authority: signer.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  atomicTx.add(logIx);

  const signature = await provider.sendAndConfirm(atomicTx, [signer]);

  const submittedTx = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  const chainFeeLamports = submittedTx?.meta?.fee ?? null;

  return {
    chainRef: signature,
    chainSequence: submittedTx?.slot ?? null,
    chainTimestamp: nowIso(),
    status: "submitted",
    chainFeeLamports: chainFeeLamports ?? undefined,
    estimatedCostUsd: estimateChainWriteCostUsd(chainFeeLamports),
  };
}

async function initializePatientLogViaAnchor(patientHash: string): Promise<{
  pda: string | null;
  status: "initialized" | "exists" | "skipped_missing_config" | "failed";
  error?: string;
}> {
  const forceLocalAudit =
    process.env.MEDAGENT_FORCE_LOCAL_AUDIT === "1" ||
    process.env.MEDAGENT_FORCE_LOCAL_AUDIT === "true";
  const signer = getSignerKeypair();
  if (forceLocalAudit || !signer) {
    return { pda: null, status: "skipped_missing_config" };
  }

  try {
    const connection = getSolanaConnection();
    await ensureSignerHasLamports(connection, signer);
    const wallet = getAnchorCompatibleWallet(signer) as Wallet;
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
    const { idl, programId } = loadProgramIdAndIdl();
    const program = new Program(idl as never, provider);

    const selectedSeed = deriveAuditSeedSha256(patientHash);
    const auditLogPda = PublicKey.findProgramAddressSync(
      [AUDIT_SEED_PREFIX, Buffer.from(selectedSeed)],
      programId,
    )[0];
    const auditLogInfo = await connection.getAccountInfo(auditLogPda, {
      commitment: "confirmed",
    });

    if (auditLogInfo) {
      return { pda: auditLogPda.toBase58(), status: "exists" };
    }

    await program.methods
      .initializeAuditLog(patientHash, toFixedArray(selectedSeed))
      .accounts({
        auditLog: auditLogPda,
        authority: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { pda: auditLogPda.toBase58(), status: "initialized" };
  } catch (error) {
    return {
      pda: null,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function submitEventOnChain(
  event: AuditEvent,
): Promise<AuditWriteResult> {
  try {
    return await submitViaAnchor(event);
  } catch (anchorError) {
    return {
      chainRef: localChainRef(event.request_id),
      chainSequence: null,
      chainTimestamp: nowIso(),
      status: "failed",
      estimatedCostUsd: 0,
      error:
        anchorError instanceof Error
          ? `Anchor audit write failed: ${anchorError.message}`
          : "Anchor audit write failed",
    };
  }
}

async function runDryRunWriteCheck(): Promise<{
  passed: boolean;
  detail: string;
}> {
  try {
    const signer = getSignerKeypair();
    if (!signer) {
      return {
        passed: false,
        detail: "Dry-run skipped: SOLANA_PRIVATE_KEY is not configured.",
      };
    }

    const connection = getSolanaConnection();
    await connection.getLatestBlockhash("confirmed");
    loadProgramIdAndIdl();

    return {
      passed: true,
      detail:
        "Dry-run succeeded: RPC reachable, signer available, and medagent_audit IDL loaded without submitting an on-chain event.",
    };
  } catch (error) {
    return {
      passed: false,
      detail:
        error instanceof Error
          ? `Dry-run failed: ${error.message}`
          : "Dry-run failed.",
    };
  }
}

export const solanaAuditStore: AuditStore = {
  async initializePatientLog(input) {
    return initializePatientLogViaAnchor(input.patientHash);
  },

  async writeAuditEvent(input) {
    const existingByRequestAndType = getAuditEventByRequestAndType(
      input.requestId,
      input.event.event_type,
    );
    if (existingByRequestAndType) {
      return {
        chainRef: existingByRequestAndType.chain_ref,
        chainSequence: existingByRequestAndType.chain_sequence,
        chainTimestamp:
          existingByRequestAndType.chain_timestamp ??
          existingByRequestAndType.created_at,
        status: "submitted",
      };
    }

    const idempotencyKey = buildAuditIdempotencyKey(input);
    let pending = getPendingAuditEventByKey(idempotencyKey);
    if (!pending) {
      pending = upsertPendingAuditEvent({
        idempotencyKey,
        requestId: input.requestId,
        patientId: input.patientId,
        payload: input.event,
        status: "pending",
      });
    }

    if (pending?.chainRef) {
      const existingByChainRef = getAuditEventByChainRef(pending.chainRef);
      if (existingByChainRef) {
        upsertPendingAuditEvent({
          idempotencyKey,
          requestId: input.requestId,
          patientId: input.patientId,
          payload: input.event,
          status: "persisted",
          chainRef: existingByChainRef.chain_ref,
          chainSequence: existingByChainRef.chain_sequence,
          chainTimestamp:
            existingByChainRef.chain_timestamp ?? existingByChainRef.created_at,
          error: null,
        });
        return {
          chainRef: existingByChainRef.chain_ref,
          chainSequence: existingByChainRef.chain_sequence,
          chainTimestamp:
            existingByChainRef.chain_timestamp ?? existingByChainRef.created_at,
          status: "submitted",
        };
      }

      try {
        await createAuditEvent({
          id: crypto.randomUUID(),
          requestId: input.requestId,
          patientId: input.patientId,
          eventType: input.event.event_type,
          decision: input.event.decision,
          doctorHash: input.event.doctor_hash,
          patientHash: input.event.patient_hash,
          jurisdiction: input.event.jurisdiction,
          tokenExpiry: input.event.token_expiry,
          payload: input.event,
          chainRef: pending.chainRef,
          chainSequence: pending.chainSequence,
          chainTimestamp: pending.chainTimestamp,
        });
        upsertPendingAuditEvent({
          idempotencyKey,
          requestId: input.requestId,
          patientId: input.patientId,
          payload: input.event,
          status: "persisted",
          chainRef: pending.chainRef,
          chainSequence: pending.chainSequence,
          chainTimestamp: pending.chainTimestamp,
          error: null,
        });
        return {
          chainRef: pending.chainRef,
          chainSequence: pending.chainSequence,
          chainTimestamp: pending.chainTimestamp,
          status: "submitted",
        };
      } catch (error) {
        upsertPendingAuditEvent({
          idempotencyKey,
          requestId: input.requestId,
          patientId: input.patientId,
          payload: input.event,
          status: "failed",
          chainRef: pending.chainRef,
          chainSequence: pending.chainSequence,
          chainTimestamp: pending.chainTimestamp,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new Error(
          `Audit recovery persistence failed for chainRef ${pending.chainRef}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const write = await submitEventOnChain(input.event);
    upsertPendingAuditEvent({
      idempotencyKey,
      requestId: input.requestId,
      patientId: input.patientId,
      payload: input.event,
      status: "onchain_submitted",
      chainRef: write.chainRef,
      chainSequence: write.chainSequence,
      chainTimestamp: write.chainTimestamp,
      error: write.error ?? null,
    });

    const existingByChainRef = getAuditEventByChainRef(write.chainRef);
    if (existingByChainRef) {
      upsertPendingAuditEvent({
        idempotencyKey,
        requestId: input.requestId,
        patientId: input.patientId,
        payload: input.event,
        status: "persisted",
        chainRef: existingByChainRef.chain_ref,
        chainSequence: existingByChainRef.chain_sequence,
        chainTimestamp:
          existingByChainRef.chain_timestamp ?? existingByChainRef.created_at,
        error: null,
      });
      return {
        chainRef: existingByChainRef.chain_ref,
        chainSequence: existingByChainRef.chain_sequence,
        chainTimestamp:
          existingByChainRef.chain_timestamp ?? existingByChainRef.created_at,
        status: "submitted",
      };
    }

    try {
      await createAuditEvent({
        id: crypto.randomUUID(),
        requestId: input.requestId,
        patientId: input.patientId,
        eventType: input.event.event_type,
        decision: input.event.decision,
        doctorHash: input.event.doctor_hash,
        patientHash: input.event.patient_hash,
        jurisdiction: input.event.jurisdiction,
        tokenExpiry: input.event.token_expiry,
        payload: input.event,
        chainRef: write.chainRef,
        chainSequence: write.chainSequence,
        chainTimestamp: write.chainTimestamp,
      });
      upsertPendingAuditEvent({
        idempotencyKey,
        requestId: input.requestId,
        patientId: input.patientId,
        payload: input.event,
        status: "persisted",
        chainRef: write.chainRef,
        chainSequence: write.chainSequence,
        chainTimestamp: write.chainTimestamp,
        error: null,
      });
    } catch (error) {
      upsertPendingAuditEvent({
        idempotencyKey,
        requestId: input.requestId,
        patientId: input.patientId,
        payload: input.event,
        status: "failed",
        chainRef: write.chainRef,
        chainSequence: write.chainSequence,
        chainTimestamp: write.chainTimestamp,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error("Failed to persist audit event after chain write", {
        requestId: input.requestId,
        patientId: input.patientId,
        chainRef: write.chainRef,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Audit persistence failed after chain submission ${write.chainRef}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return write;
  },

  async listAuditEvents(patientId: string) {
    return listAuditEventsFromDb(patientId);
  },

  async readinessCheck(input?: { dryRun?: boolean }) {
    const configured = isSolanaConfigured();
    const cluster = getSolanaCluster();

    const checks: AuditReadinessResult["checks"] = [
      {
        key: "credentials",
        passed: configured,
        detail: configured
          ? "SOLANA_PRIVATE_KEY is configured."
          : "SOLANA_PRIVATE_KEY is missing, so writes will remain local-only fallback.",
      },
      {
        key: "rpc",
        passed: false,
        detail: `RPC check pending for cluster ${cluster}.`,
      },
    ];

    try {
      const connection = getSolanaConnection();
      const version = await withTimeout(
        connection.getVersion(),
        5_000,
        "getVersion",
      );
      checks[1] = {
        key: "rpc",
        passed: true,
        detail: `RPC reachable for cluster ${cluster} (core ${version["solana-core"]}).`,
      };
    } catch (error) {
      checks[1] = {
        key: "rpc",
        passed: false,
        detail:
          error instanceof Error
            ? `RPC check failed for cluster ${cluster}: ${error.message}`
            : `RPC check failed for cluster ${cluster}.`,
      };
    }

    if (!configured) {
      return {
        ready: false,
        mode: "fallback",
        cluster,
        checks,
      };
    }

    const dryRun = input?.dryRun ?? true;
    const write = dryRun
      ? await runDryRunWriteCheck()
      : {
          passed: false,
          detail:
            "Live readiness writes are disabled. Use dry-run validation instead.",
        };
    checks.push({
      key: "write",
      passed: write.passed,
      detail: write.detail,
    });

    return {
      ready: checks.every((check) => check.passed),
      mode: "live",
      cluster,
      checks,
    };
  },
};
