import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { validateDoctorSession } from "@/lib/verification/session";

export default function DoctorDashboardPage() {
  const token = cookies().get("doctor_token")?.value;
  if (!token) redirect("/doctor/login");

  const session = validateDoctorSession(token);
  if (!session.valid) redirect("/doctor/login");

  return (
    <main className="min-h-[calc(100vh-3.5rem)] px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-green-700">
            Verified doctor session
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Welcome, {session.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Registration number {session.regNumber} is verified for the demo.
          </p>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-base font-medium">Demo actions</h2>
          <p className="mt-2 text-sm text-slate-600">
            Continue through the iMessage bridge for patient access requests, then
            review Sarah Bennett&apos;s Solana-backed audit trail.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/audit/sarah-bennett">Open audit log</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/patient/dashboard">Patient dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
