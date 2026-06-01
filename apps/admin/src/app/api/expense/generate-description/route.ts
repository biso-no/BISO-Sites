import { createSessionClient } from "@repo/api/server";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";

const FUNCTION_ID =
  process.env.APPWRITE_GENERATE_DESCRIPTION_FUNCTION_ID ||
  "generateDescription";

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (auth.response) {
    return auth.response;
  }

  let payload: { descriptions?: unknown; event?: unknown };
  try {
    payload = await request.json();
  } catch (_error) {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const { descriptions, event } = payload ?? {};
  if (descriptions === undefined && event === undefined) {
    return NextResponse.json(
      { error: "Missing required parameter: descriptions or event" },
      { status: 400 }
    );
  }

  try {
    // Invoke the Appwrite function through the user-scoped client so it runs
    // under the caller's permissions. The service API key must never be
    // attached to a hand-built request (it bypasses row security entirely).
    const { functions } = await createSessionClient();
    const execution = await functions.createExecution(
      FUNCTION_ID,
      JSON.stringify({ descriptions, event })
    );
    return NextResponse.json(execution);
  } catch (error) {
    console.error("Error in generate-description:", error);
    return NextResponse.json(
      { error: "Failed to generate description" },
      { status: 500 }
    );
  }
}
