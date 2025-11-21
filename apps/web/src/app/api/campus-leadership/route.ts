import { createSessionClient } from "@repo/api/server";
import { NextResponse } from "next/server";

const FUNCTION_ID =
  process.env.APPWRITE_CAMPUS_BOARD_FUNCTION_ID || "get_board_members";

export async function POST(request: Request) {
  let payload: any;

  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const campus = payload?.campus ?? payload?.campusId ?? null;
  const departmentId = payload?.departmentId ?? null;

  if (!campus) {
    return NextResponse.json(
      { success: false, message: "Missing required parameter: campus" },
      { status: 400 }
    );
  }

  try {
    const { functions } = await createSessionClient();
    const execution = await functions.createExecution(
      FUNCTION_ID,
      JSON.stringify({ campus, departmentId })
    );

    const raw =
      (execution as any)?.response ||
      (execution as any)?.stdout ||
      (execution as any)?.result ||
      null;

    let parsed: any = null;
    if (raw && typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        parsed = null;
      }
    }

    const data = parsed ?? {
      success: (execution as any)?.status === "completed",
      response: raw,
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Failed to load campus leadership", error);
    return NextResponse.json(
      { success: false, message: "Failed to load campus leadership" },
      { status: 500 }
    );
  }
}
