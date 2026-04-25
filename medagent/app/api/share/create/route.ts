import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { validatePatientJwt } from "@/lib/auth/patientAuth";
import { createShareRecord } from "@/lib/sharing/createShare";
import { ReleasedFieldSchema } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const token = cookies().get("patient_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = validatePatientJwt(token);
    if (!session.valid || !session.patientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      doctorName,
      doctorEmail,
      fieldsToShare,
      ttlHours,
      shareScope,
      appointmentId,
    } = body;

    if (!doctorName || !doctorEmail) {
      return NextResponse.json(
        { error: "doctorName and doctorEmail are required" },
        { status: 400 },
      );
    }

    const isFullRecord = shareScope === "full_record";
    const validFields = Array.isArray(fieldsToShare)
      ? fieldsToShare.filter((f: string) => ReleasedFieldSchema.safeParse(f).success)
      : [];
    if (!isFullRecord && validFields.length === 0) {
      return NextResponse.json(
        { error: "No valid fields selected" },
        { status: 400 },
      );
    }

    const result = await createShareRecord({
      patientId: session.patientId,
      doctorName,
      doctorEmail,
      fieldsToShare: validFields,
      ttlHours: ttlHours ?? 24,
      shareScope: isFullRecord ? "full_record" : "field_subset",
      appointmentId: typeof appointmentId === "string" ? appointmentId : null,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("Maximum active shares") ? 429 : 500;
    if (status === 500) console.error("Share create error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
