import { NextRequest, NextResponse } from "next/server";

import { lookupDoctor } from "@/lib/verification/lookupDoctor";
import {
  countRecentOtps,
  createOtpRecord,
  generateOtp,
  sendOtp,
} from "@/lib/verification/otp";

const MAX_OTPS_PER_HOUR = 3;

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
      return NextResponse.json(
        { error: "Doctor not found" },
        { status: 404 },
      );
    }

    const recentCount = countRecentOtps(regNumber.trim());
    if (recentCount >= MAX_OTPS_PER_HOUR) {
      return NextResponse.json(
        { error: "Too many OTP requests. Please try again later." },
        { status: 429 },
      );
    }

    const otp = generateOtp();
    const otpId = createOtpRecord(regNumber.trim(), doctor.email, otp);
    const result = await sendOtp(doctor.email, otp, doctor.name);

    if (!result.sent) {
      return NextResponse.json(
        { error: result.error ?? "Failed to send OTP" },
        { status: 500 },
      );
    }

    const response: Record<string, unknown> = { sent: true, otpId };
    if (result.devOtp) {
      response.devOtp = result.devOtp;
    }
    return NextResponse.json(response);
  } catch (error) {
    console.error("OTP send error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
