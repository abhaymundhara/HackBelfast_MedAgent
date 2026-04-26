import { getSharedRecord } from "@/lib/db";
import { getSolscanTxUrl } from "@/lib/solana/client";
import { RevokeShareButton } from "@/components/app/revoke-share-button";
import { SiteNav } from "@/components/landing/site-nav";
import { SiteFooter } from "@/components/landing/site-footer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RevokeSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const share = getSharedRecord(id);

  if (!share) {
    return (
      <div className="landing-root">
        <SiteNav />
        <main style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
          <div style={{
            maxWidth: 480,
            width: "100%",
            background: "var(--red-bg)",
            border: "1px solid var(--red)",
            borderRadius: 16,
            padding: "40px 32px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>!</div>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--red)", marginBottom: 8 }}>
              Share not found
            </h1>
            <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.6 }}>
              This share link is invalid or has been removed.
            </p>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const isExpired = new Date(share.expires_at) <= new Date();
  const isRevoked = share.status === "revoked";
  const isActive = share.status === "active" && !isExpired;
  const scope =
    share.share_scope === "full_record"
      ? "Full medical record"
      : "Selected fields";

  const solscanUrl =
    isRevoked && share.revoke_chain_ref && !share.revoke_chain_ref.startsWith("local-solana:")
      ? getSolscanTxUrl(share.revoke_chain_ref)
      : null;

  return (
    <div className="landing-root">
      <SiteNav />
      <main style={{
        minHeight: "80vh",
        background: "var(--bg-2)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "64px 24px",
      }}>
        <div style={{ maxWidth: 480, width: "100%" }}>
          {/* Header */}
          <div style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid var(--line)",
            padding: "32px",
            textAlign: "center",
            boxShadow: "var(--shadow)",
            marginBottom: 16,
          }}>
            <span style={{
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.14em",
              textTransform: "uppercase" as const,
              color: "var(--ink-mute)",
            }}>
              Manage Access
            </span>
            <h1 style={{
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              marginTop: 8,
              color: "var(--ink)",
            }}>
              Revoke Record Share
            </h1>
          </div>

          {/* Share Details */}
          <div style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid var(--line)",
            padding: "24px 28px",
            boxShadow: "var(--shadow-sm)",
            marginBottom: 16,
          }}>
            {[
              { label: "Shared with", value: share.doctor_name },
              { label: "Scope", value: scope },
              {
                label: "Status",
                value: isActive ? "Active" : isRevoked ? "Revoked" : "Expired",
                color: isActive ? "var(--green)" : isRevoked ? "var(--red)" : "var(--ink-mute)",
              },
              {
                label: "Expires",
                value: new Date(share.expires_at).toLocaleString(),
              },
            ].map(({ label, value, color }, i) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: i < 3 ? "1px solid var(--line-2)" : undefined,
                }}
              >
                <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{label}</span>
                <span style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: color ?? "var(--ink)",
                }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Active — Revoke CTA */}
          {isActive && (
            <div style={{
              background: "var(--red-bg)",
              borderRadius: 16,
              border: "1px solid var(--red)",
              padding: "28px 28px",
              textAlign: "center",
            }}>
              <p style={{
                fontSize: 13,
                color: "var(--red)",
                lineHeight: 1.6,
                marginBottom: 20,
              }}>
                Revoking will immediately block any future access to your record
                through this share link. This action is recorded on the Solana blockchain
                for your protection.
              </p>
              <RevokeShareButton shareId={share.id} />
            </div>
          )}

          {/* Revoked — Confirmation */}
          {isRevoked && (
            <div style={{
              background: "var(--green-bg)",
              borderRadius: 16,
              border: "1px solid var(--green)",
              padding: "28px 28px",
              textAlign: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="var(--green)">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--green)" }}>
                  Access has been revoked
                </span>
              </div>
              {solscanUrl && (
                <a
                  href={solscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    color: "var(--green)",
                    textDecoration: "underline",
                    marginTop: 8,
                  }}
                >
                  View revocation proof on Solscan
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-4.5-6H18m0 0v4.5m0-4.5l-7.5 7.5" />
                  </svg>
                </a>
              )}
            </div>
          )}

          {/* Expired */}
          {isExpired && !isRevoked && (
            <div style={{
              background: "var(--amber-bg)",
              borderRadius: 16,
              border: "1px solid var(--amber)",
              padding: "28px 28px",
              textAlign: "center",
            }}>
              <p style={{ fontSize: 13, color: "var(--amber)", lineHeight: 1.6 }}>
                This share has expired. The doctor can no longer access your
                record through this link.
              </p>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
