declare module "solana-agent-kit" {
  export interface SolanaPublicKeyLike {
    toBase58(): string;
  }

  export class SolanaAgentKit {
    constructor(
      privateKey: string,
      rpcUrl: string,
      options?: Record<string, unknown>,
    );

    walletAddress: SolanaPublicKeyLike;
  }
}

declare module "solana-agent-kit/langchain" {
  import type { SolanaAgentKit } from "solana-agent-kit";

  export interface SolanaLangChainTool {
    name: string;
    description?: string;
    invoke(input: unknown): Promise<unknown>;
  }

  export function createSolanaTools(
    agent: SolanaAgentKit,
    options?: Record<string, unknown>,
  ): SolanaLangChainTool[];
}
