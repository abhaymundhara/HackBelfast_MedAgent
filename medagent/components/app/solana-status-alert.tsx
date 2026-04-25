import { isSolanaConfigured } from "@/lib/solana/client";

export function SolanaStatusAlert() {
  const configured = isSolanaConfigured();

  if (!configured) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Fallback mode</p>
        <p className="mt-1 text-amber-800">
          Solana credentials are not configured, so on-chain audit submission is
          disabled in this environment. Configure Solana credentials on the
          server environment to enable live writes.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
      <p className="font-medium">Live Solana mode</p>
      <p className="mt-1 text-green-800">
        Audit logging is configured for Solana. Run `npm run demo:readiness`
        before judging to confirm live submission.
      </p>
    </div>
  );
}
