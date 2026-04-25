import { NextRequest, NextResponse } from "next/server";

import { loginPatient } from "@/lib/auth/patientAuth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password are required" },
        { status: 400 },
      );
    }

    const result = await loginPatient(email, password);

    if (!result) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    return NextResponse.json({
      jwt: result.jwt,
      patientId: result.patientId,
    });
  } catch (error) {
    console.error("Patient login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
