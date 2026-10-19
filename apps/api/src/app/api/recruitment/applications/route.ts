import { extractTextFromPdf } from "@repo/ai/server/pdf-text-extractor";
import { screenApplication } from "@repo/ai/server/recruitment-screener";
import { createAdminClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { isAuthenticatedAppwriteUser } from "@repo/shared/recruitment";
import {
  listApplicationsForApplicant,
  type RecruitmentApplicant,
  type RecruitmentApplyErrorCode,
  runRecruitmentScreening,
  submitRecruitmentApplication,
} from "@repo/shared/recruitment/apply";
import { sanitizeStudentNumber } from "@repo/shared/utils/bi-student";
import { after, type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import { getMembershipStatusForStudent } from "@/lib/membership-status-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_BY_CODE: Record<RecruitmentApplyErrorCode, number> = {
  already_applied: 409,
  answer_required: 400,
  cover_letter_required: 400,
  cv_required: 400,
  invalid_data: 400,
  invalid_file: 400,
  members_only: 403,
  submit_failed: 500,
  vacancy_closed: 404,
};

/**
 * The API proxy's request body cap. A larger body is cut off before it gets
 * here, so `req.formData()` would fail and the applicant would be told their
 * data is invalid; the declared length is checked first instead.
 */
const MAX_BODY_BYTES = 10_485_760;

function isOverBodyLimit(req: NextRequest): boolean {
  const declared = Number(req.headers.get("content-length"));
  return Number.isFinite(declared) && declared > MAX_BODY_BYTES;
}

function isRowNotFound(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 404;
}

/**
 * The caller behind the bearer token, when it is a real (non-anonymous)
 * account with an email — applications are filed under that email.
 *
 * A bearer token is required, as on the expense-attachment route: the POST
 * body is `multipart/form-data`, a CORS-safelisted type, so a cross-origin
 * form post carrying a session cookie would never be preflighted. Only the
 * app sends a token, so demanding one keeps another site from applying as
 * the caller.
 */
async function authenticatedApplicant(
  req: NextRequest
): Promise<RecruitmentApplicant | null> {
  if (!req.headers.get("authorization")?.startsWith("Bearer ")) {
    return null;
  }
  try {
    const { account } = await createAuthenticatedClient(req);
    const user = await account.get();
    if (!(isAuthenticatedAppwriteUser(user) && user.email)) {
      return null;
    }
    return { email: user.email, name: user.name, userId: user.$id };
  } catch {
    return null;
  }
}

/**
 * Live membership from the profile's BI student number, refreshed as the
 * membership route's `?refresh=1` is: a student who bought a membership a
 * moment ago must be able to apply at once. No student number, no member.
 */
async function isMemberByProfile(userId: string): Promise<boolean> {
  const { db } = await createAdminClient();
  const profile = await db
    .getRow<Users>("app", "user", userId)
    .catch((error: unknown) => {
      if (isRowNotFound(error)) {
        return null;
      }
      throw error;
    });
  const studentNumber = sanitizeStudentNumber(profile?.student_id);
  if (studentNumber === null) {
    return false;
  }
  const status = await getMembershipStatusForStudent(studentNumber, {
    refresh: true,
  });
  return status.isMember;
}

/**
 * Applies for a vacancy as the caller. Same flow and field names as the
 * website's apply form (`@repo/shared/recruitment/apply`); the applicant's
 * email and name come from the account, never from the form.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const json = (data: unknown, status = 200) =>
    applyCorsHeaders(NextResponse.json(data, { status }), origin);

  const applicant = await authenticatedApplicant(req);
  if (!applicant) {
    return json({ success: false, error: "Authentication required" }, 401);
  }

  if (isOverBodyLimit(req)) {
    return json(
      {
        code: "invalid_file",
        error:
          "Your files are too large together. Keep the CV and cover letter under 9 MB in total.",
        success: false,
      },
      413
    );
  }

  const formData = await req.formData().catch(() => null);
  const jobId = formData?.get("job_id");
  if (!formData || typeof jobId !== "string" || jobId.length === 0) {
    return json(
      {
        code: "invalid_data",
        error: "Invalid application data.",
        success: false,
      },
      400
    );
  }

  const result = await submitRecruitmentApplication(
    { applicant, formData, jobId },
    {
      extractPdfText: extractTextFromPdf,
      isMember: () => isMemberByProfile(applicant.userId),
    }
  );
  if (!result.success) {
    return json(
      { code: result.code, error: result.error, success: false },
      STATUS_BY_CODE[result.code]
    );
  }

  const { screening } = result;
  if (screening) {
    after(() => runRecruitmentScreening(screening, screenApplication));
  }
  return json({ applicationId: result.applicationId, success: true }, 201);
}

/** The caller's own applications, newest first. */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const json = (data: unknown, status = 200) => {
    const response = NextResponse.json(data, { status });
    response.headers.set("Cache-Control", "private, no-store");
    return applyCorsHeaders(response, origin);
  };

  const applicant = await authenticatedApplicant(req);
  if (!applicant) {
    return json({ success: false, error: "Authentication required" }, 401);
  }

  try {
    const applications = await listApplicationsForApplicant(applicant.email);
    return json({ applications });
  } catch (error) {
    console.error("[recruitment/applications] List failed:", error);
    return json({ success: false, error: "Failed to load applications" }, 500);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
