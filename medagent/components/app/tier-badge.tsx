import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function TierBadge({
  tier,
  decision,
  className,
}: {
  tier: 1 | 2 | 3 | null;
  decision?: "granted" | "denied" | "awaiting_human";
  className?: string;
}) {
  const label =
    decision === "denied"
      ? "Denied"
      : decision === "awaiting_human"
        ? "Awaiting approval"
        : tier
          ? `Tier ${tier}`
          : "No tier";

  const tone =
    decision === "denied"
      ? "bg-denied text-denied-foreground"
      : decision === "awaiting_human"
        ? "bg-tier2 text-tier2-foreground"
        : tier === 1
          ? "bg-tier1 text-tier1-foreground"
          : tier === 2
            ? "bg-tier2 text-tier2-foreground"
            : "bg-tier3 text-tier3-foreground";

  return <Badge className={cn("rounded-full px-3 py-1 text-xs", tone, className)}>{label}</Badge>;
}
