import { isAuthenticatedAppwriteUser } from "@repo/shared/recruitment";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient, extractJwtFromRequest } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import { submitRecruitmentApplication } from "@/lib/recruitment-apply";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const origin = req.headers.get("origin");

  try {
    if (!extractJwtFromRequest(req)) {
      return applyCorsHeaders(
        NextResponse.json(
          { success: false, error: "Authentication required" },
          { status: 401 }
        ),
        origin
      );
    }

    const { account } = await createAuthenticatedClient(req);
    const user = await account.get().catch(() => null);
    if (!(user && isAuthenticatedAppwriteUser(user) && user.email)) {
      return applyCorsHeaders(
        NextResponse.json(
          {
            success: false,
            error: "You must sign in with a verified account before applying.",
          },
          { status: 401 }
        ),
        origin
      );
    }

    const { jobId } = await params;
    const formData = await req.formData();
    const result = await submitRecruitmentApplication(jobId, formData, user);

    if (!result.ok) {
      return applyCorsHeaders(
        NextResponse.json(
          { success: false, error: result.error },
          { status: result.status }
        ),
        origin
      );
    }

    return applyCorsHeaders(
      NextResponse.json(
        { success: true, application_id: result.applicationId },
        { status: 201 }
      ),
      origin
    );
  } catch (error) {
    console.error("[jobs/apply] Unexpected error:", error);
    return applyCorsHeaders(
      NextResponse.json(
        { success: false, error: "Failed to submit application." },
        { status: 500 }
      ),
      origin
    );
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
