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
  const DECISION_CONFIG: Record<string, { label: string; tone: string }> = {
    denied: { label: "Denied", tone: "bg-denied text-denied-foreground" },
    awaiting_human: { label: "Awaiting approval", tone: "bg-tier2 text-tier2-foreground" },
  };

  const TIER_TONE: Record<number, string> = {
    1: "bg-tier1 text-tier1-foreground",
    2: "bg-tier2 text-tier2-foreground",
    3: "bg-tier3 text-tier3-foreground",
  };

  const decisionCfg = decision ? DECISION_CONFIG[decision] : undefined;
  const label = decisionCfg?.label ?? (tier ? `Tier ${tier}` : "No tier");
  const tone = decisionCfg?.tone ?? (tier ? TIER_TONE[tier] : "bg-tier3 text-tier3-foreground");

  return <Badge className={cn("rounded-full px-3 py-1 text-xs", tone, className)}>{label}</Badge>;
}
