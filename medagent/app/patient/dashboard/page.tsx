import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";

import { ApprovalControls } from "@/components/app/approval-controls";
import { Separator } from "@/components/ui/separator";
import { listPatientsSafe, getPatientSafeProfile } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PatientDashboardPage({
  searchParams,
}: {
  searchParams: { patientId?: string };
}) {
  const patients = listPatientsSafe();
  const patientId = searchParams.patientId || patients[0]?.patientId;
  const profile = patientId ? getPatientSafeProfile(patientId) : null;
  const qrValue = profile?.patientId
    ? JSON.stringify({
        patientId: profile.patientId,
        // New Solana-aligned keys.
        auditRef: profile.auditRef ?? null,
        chainIdentity: profile.chainIdentity ?? null,
        // Legacy aliases for existing scanners/backends.
        topicId: profile.auditRef ?? null,
        hederaIdentity: profile.chainIdentity ?? profile.localIdentity ?? null,
      })
    : null;
  const qrDataUrl = qrValue
    ? await QRCode.toDataURL(qrValue, { margin: 1, width: 220 })
    : null;

  return (
    <main className="container max-w-2xl space-y-8 py-10">
      {profile ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {profile.name}
              </h1>
              <span className="inline-flex items-center gap-1.5 text-sm text-green-700 mt-1">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Profile active
              </span>
            </div>
            {patients.length > 1 && (
              <details className="relative text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Switch patient
                </summary>
                <div className="absolute right-0 mt-2 z-10 rounded-xl border border-border bg-white p-2 shadow-lg space-y-1 min-w-[160px]">
                  {patients.map((p) => (
                    <Link
                      key={p.patientId}
                      href={`/patient/dashboard?patientId=${p.patientId}`}
                      className={`block rounded-lg px-3 py-2 text-sm ${
                        p.patientId === patientId
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted"
                      }`}
                    >
                      {p.name}
                    </Link>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* QR Code */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-center">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">
              Emergency QR code
            </p>
            {qrDataUrl ? (
              <div className="space-y-2">
                <Image
                  alt={`QR code for ${profile.name}`}
                  className="mx-auto rounded-2xl border border-border bg-white p-4"
                  src={qrDataUrl}
                  width={220}
                  height={220}
                />
                <p className="text-sm text-muted-foreground">
                  Show this to your clinician
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your QR code will appear here once your profile is fully set up.
              </p>
            )}
          </section>

          <Separator />

          {/* Access settings */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">
              Access settings
            </h2>
            <div className="divide-y divide-[#E2E8F0]">
              <div className="flex items-start justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Verified clinicians
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {profile.policy?.emergencyAutoAccess
                      ? "Clinicians from trusted institutions get immediate access"
                      : "All clinicians must request your approval first"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    profile.policy?.emergencyAutoAccess
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {profile.policy?.emergencyAutoAccess ? "On" : "Off"}
                </span>
              </div>
              <div className="flex items-start justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Approval requests
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {profile.policy?.allowPatientApprovalRequests
                      ? "Other clinicians can ask for your approval before accessing"
                      : "Only verified clinicians can access your records"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    profile.policy?.allowPatientApprovalRequests
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {profile.policy?.allowPatientApprovalRequests ? "On" : "Off"}
                </span>
              </div>
              <div className="flex items-start justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Emergency override
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {profile.policy?.breakGlassAllowed
                      ? "If you're unconscious, critical data can be accessed for your safety"
                      : "No emergency override — all access requires your approval"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    profile.policy?.breakGlassAllowed
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {profile.policy?.breakGlassAllowed ? "On" : "Off"}
                </span>
              </div>
            </div>
          </section>

          <Separator />

          {/* Pending approvals */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">
              Pending approval requests
            </h2>
            <ApprovalControls
              approvals={profile.pendingApprovals}
              patientName={profile.name}
            />
          </section>
        </>
      ) : (
        <div className="text-sm text-muted-foreground py-12 text-center">
          No patient selected.{" "}
          <Link href="/patient" className="text-primary hover:underline">
            Create a profile
          </Link>
        </div>
      )}
    </main>
  );
}
