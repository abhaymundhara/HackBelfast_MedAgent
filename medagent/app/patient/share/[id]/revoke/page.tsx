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
      <>
        <SiteNav />
        <main className="min-h-screen px-6 py-12">
          <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <h1 className="text-lg font-semibold text-red-900">
              Share not found
            </h1>
            <p className="mt-2 text-sm text-red-700">
              This share link is invalid or has been removed.
            </p>
          </div>
        </main>
        <SiteFooter />
      </>
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
    <>
      <SiteNav />
      <main className="min-h-screen bg-slate-50 px-6 py-12">
        <div className="mx-auto max-w-lg space-y-6">
          <header className="rounded-xl border bg-white p-6 shadow-sm text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Manage Access
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Revoke Record Share</h1>
          </header>

          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Shared with</span>
                <span className="font-medium">{share.doctor_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Scope</span>
                <span className="font-medium">{scope}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span
                  className={`font-medium ${
                    isActive
                      ? "text-green-700"
                      : isRevoked
                        ? "text-red-700"
                        : "text-slate-500"
                  }`}
                >
                  {isActive ? "Active" : isRevoked ? "Revoked" : "Expired"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expires</span>
                <span className="font-medium">
                  {new Date(share.expires_at).toLocaleString()}
                </span>
              </div>
            </div>
          </section>

          {isActive && (
            <section className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm text-center space-y-4">
              <p className="text-sm text-red-800">
                Revoking will immediately block any future access to your record
                through this share link. Data already viewed cannot be erased.
              </p>
              <RevokeShareButton shareId={share.id} />
            </section>
          )}

          {isRevoked && (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm text-center space-y-3">
              <p className="text-sm font-medium text-slate-700">
                Access has been revoked
              </p>
              {solscanUrl && (
                <a
                  href={solscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-green-600 underline hover:text-green-700"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  View revocation proof on Solscan
                </a>
              )}
            </section>
          )}

          {isExpired && !isRevoked && (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm text-center">
              <p className="text-sm text-slate-600">
                This share has expired. The doctor can no longer access your
                record through this link.
              </p>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
