import { NextRequest, NextResponse } from "next/server";

import { lookupDoctor } from "@/lib/verification/lookupDoctor";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***.***";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 3))}@${domain}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const regNumber = body.regNumber as string | undefined;

    if (!regNumber || typeof regNumber !== "string") {
      return NextResponse.json(
        { error: "regNumber is required" },
        { status: 400 },
      );
    }

    const doctor = lookupDoctor(regNumber.trim());

    if (!doctor) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      name: doctor.name,
      email: maskEmail(doctor.email),
      regBody: doctor.regBody,
    });
  } catch (error) {
    console.error("Doctor lookup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
