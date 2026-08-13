import { NextResponse } from "next/server";
import { readAppConfig } from "@/lib/app-config";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(readAppConfig());
}
