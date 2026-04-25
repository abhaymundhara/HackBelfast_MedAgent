import Link from "next/link";

import { SolanaStatusAlert } from "@/components/app/solana-status-alert";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-6">
      <div className="mx-auto max-w-2xl text-center space-y-8">
        <SolanaStatusAlert />
        <h1 className="text-5xl font-semibold tracking-tight text-slate-950 md:text-6xl">
          Cross-border emergency access,<br />auditable on Solana.
        </h1>
        <p className="text-lg text-slate-600 max-w-lg mx-auto">
          MedAgent gives clinicians on either side of the NI/ROI border a narrow,
          time-limited emergency summary — verified, consented, and fully auditable
          via iMessage.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="rounded-full px-8">
            <Link href="/audit/sarah-bennett">View audit log</Link>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-8 pt-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs">&#10003;</span>
            Verified access
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs">&#9201;</span>
            Time-limited sessions
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs">&#128274;</span>
            Tamper-proof audit trail
          </div>
        </div>
      </div>
    </main>
  );
}
