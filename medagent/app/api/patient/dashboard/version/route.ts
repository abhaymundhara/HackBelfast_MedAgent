import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { validatePatientJwt } from "@/lib/auth/patientAuth";
import { getPatientDashboardVersion } from "@/lib/patientDashboardVersion";

const DEMO_PATIENT_ID = "sarah-bennett";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const token = cookies().get("patient_token")?.value;
  const validated = token ? validatePatientJwt(token) : null;
  const patientId =
    validated?.valid && validated.patientId
      ? validated.patientId
      : DEMO_PATIENT_ID;

  return NextResponse.json(getPatientDashboardVersion(patientId), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
