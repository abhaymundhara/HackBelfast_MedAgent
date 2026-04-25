import Link from "next/link";

import { PatientRegistrationForm } from "@/components/app/patient-registration-form";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { listPatientsSafe } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function PatientPage() {
  const patients = listPatientsSafe();

  return (
    <main className="container max-w-2xl space-y-8 py-10">
      <div className="flex items-end justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Create your emergency profile</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/patient/dashboard?patientId=sarah-bennett">Go to dashboard</Link>
        </Button>
      </div>

      <PatientRegistrationForm />

      {patients.length > 0 && (
        <>
          <Separator />
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B] mb-3">Existing profiles</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {patients.map((patient) => (
                <Link
                  key={patient.patientId}
                  href={`/patient/dashboard?patientId=${patient.patientId}`}
                  className="group rounded-2xl border border-[#E2E8F0] bg-white p-4 text-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_4px_12px_rgba(13,115,119,0.1)] hover:-translate-y-px"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {patient.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">{patient.name}</p>
                      <p className="text-xs text-muted-foreground group-hover:text-primary transition-colors">View dashboard &rarr;</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
