import fs from "fs";
import os from "os";
import path from "path";

import {
  Connection,
  Keypair,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";

function parsePrivateKey(raw: string | undefined) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (item) =>
          typeof item === "number" &&
          Number.isInteger(item) &&
          item >= 0 &&
          item <= 255,
      )
    ) {
      return null;
    }
    return Uint8Array.from(parsed);
  } catch {
    return null;
  }
}

function readPrivateKeyFromFile(filePath: string) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return parsePrivateKey(raw);
  } catch {
    return null;
  }
}

export function getSolanaCluster() {
  return process.env.SOLANA_CLUSTER || "devnet";
}

export function getSolanaRpcUrl() {
  if (process.env.SOLANA_RPC_URL) {
    return process.env.SOLANA_RPC_URL;
  }

  const cluster = getSolanaCluster();
  if (
    cluster === "mainnet-beta" ||
    cluster === "testnet" ||
    cluster === "devnet"
  ) {
    return clusterApiUrl(cluster);
  }

  throw new Error(
    `Invalid SOLANA_CLUSTER "${cluster}". Set SOLANA_CLUSTER to one of: devnet, testnet, mainnet-beta, or provide SOLANA_RPC_URL explicitly.`,
  );
}

export function getSolanaConnection() {
  return new Connection(getSolanaRpcUrl(), "confirmed");
}

export function getSignerKeypair() {
  const secret =
    parsePrivateKey(process.env.SOLANA_PRIVATE_KEY) ??
    readPrivateKeyFromFile(
      process.env.SOLANA_KEYPAIR_PATH ||
        path.join(os.homedir(), ".config", "solana", "id.json"),
    );
  if (!secret) {
    return null;
  }

  try {
    return Keypair.fromSecretKey(secret);
  } catch {
    return null;
  }
}

export function isSolanaConfigured() {
  return Boolean(getSignerKeypair());
}

export function getSolscanTxUrl(signature: string) {
  const cluster = getSolanaCluster();
  const clusterParam = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://solscan.io/tx/${signature}${clusterParam}`;
}

export function getSolscanSlotUrl(slot: number) {
  const cluster = getSolanaCluster();
  const clusterParam = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://solscan.io/block/${slot}${clusterParam}`;
}

export function getAnchorCompatibleWallet(signer: Keypair) {
  return {
    publicKey: signer.publicKey,
    async signTransaction(tx: Transaction) {
      tx.partialSign(signer);
      return tx;
    },
    async signAllTransactions(txs: Transaction[]) {
      txs.forEach((tx) => tx.partialSign(signer));
      return txs;
    },
  };
}
