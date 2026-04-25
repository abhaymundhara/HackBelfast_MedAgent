import { NextRequest, NextResponse } from "next/server";

import { lookupDoctor } from "@/lib/verification/lookupDoctor";
import { verifyOtp } from "@/lib/verification/otp";
import { createDoctorSession } from "@/lib/verification/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const regNumber = body.regNumber as string | undefined;
    const code = body.code as string | undefined;

    if (!regNumber || !code) {
      return NextResponse.json(
        { error: "regNumber and code are required" },
        { status: 400 },
      );
    }

    const result = verifyOtp(regNumber.trim(), code.trim());
    if (!result.valid) {
      return NextResponse.json(
        { verified: false, error: result.error },
        { status: 401 },
      );
    }

    const doctor = lookupDoctor(regNumber.trim());
    if (!doctor) {
      return NextResponse.json(
        { error: "Doctor not found" },
        { status: 404 },
      );
    }

    const session = createDoctorSession(doctor.regNumber, doctor.name);

    return NextResponse.json({
      verified: true,
      jwt: session.jwt,
      expiresAt: session.expiresAt,
      doctor: {
        regNumber: doctor.regNumber,
        regBody: doctor.regBody,
        name: doctor.name,
        specialty: doctor.specialty,
        hospital: doctor.hospital,
        jurisdiction: doctor.jurisdiction,
      },
    });
  } catch (error) {
    console.error("OTP verify error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
