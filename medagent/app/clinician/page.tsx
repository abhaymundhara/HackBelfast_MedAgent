import { ClinicianConsole } from "@/components/app/clinician-console";
import { SolanaStatusAlert } from "@/components/app/solana-status-alert";
import { listPatientsSafe } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function ClinicianPage() {
  const patients = listPatientsSafe().map((patient) => ({
    patientId: patient.patientId,
    name: patient.name,
  }));

  return (
    <main className="container max-w-2xl space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Request patient records</h1>
      </div>
      <SolanaStatusAlert />
      <ClinicianConsole patients={patients} />
    </main>
  );
}
