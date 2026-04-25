import { NextResponse } from "next/server";

import { getPatientSafeProfile } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const profile = getPatientSafeProfile(params.id);
  if (!profile) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }
  return NextResponse.json(profile);
}
