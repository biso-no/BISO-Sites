import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      //environment: process.env.NODE_ENV
    },
    { status: 200 }
  );
}
