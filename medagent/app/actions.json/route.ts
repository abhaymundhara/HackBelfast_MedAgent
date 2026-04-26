import { NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  return NextResponse.json(
    {
      rules: [
        {
          pathPattern: "/share/*",
          apiPath: "/api/actions/share/*",
        },
        {
          pathPattern: "/audit/*",
          apiPath: "/api/actions/audit/*",
        },
      ],
    },
    { headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
  );
}
