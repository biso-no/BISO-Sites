import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({ get: vi.fn() }));
const getRow = vi.hoisted(() => vi.fn());
const getMembershipStatusForStudent = vi.hoisted(() => vi.fn());
const submitRecruitmentApplication = vi.hoisted(() => vi.fn());
const listApplicationsForApplicant = vi.hoisted(() => vi.fn());
const runRecruitmentScreening = vi.hoisted(() => vi.fn());
const after = vi.hoisted(() => vi.fn());
const screenApplication = vi.hoisted(() => vi.fn());
const extractTextFromPdf = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after,
}));
vi.mock("@/lib/auth", () => ({
  createAuthenticatedClient: vi.fn(async () => ({ account })),
}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: { getRow } })),
}));
vi.mock("@/lib/membership-status-cache", () => ({
  getMembershipStatusForStudent,
}));
vi.mock("@repo/shared/recruitment/apply", () => ({
  listApplicationsForApplicant,
  runRecruitmentScreening,
  submitRecruitmentApplication,
}));
vi.mock("@repo/ai/server/recruitment-screener", () => ({
  screenApplication,
}));
vi.mock("@repo/ai/server/pdf-text-extractor", () => ({
  extractTextFromPdf,
}));

import { GET, OPTIONS, POST } from "./route";

const USER = {
  $id: "user-1",
  email: "kari.nordmann@student.bi.no",
  emailVerification: true,
  name: "Kari Nordmann",
};

function postRequest(
  form: FormData,
  authorization = "Bearer jwt",
  headers: Record<string, string> = {}
) {
  return new Request("https://api.biso.no/api/recruitment/applications", {
    body: form,
    headers: authorization ? { authorization, ...headers } : headers,
    method: "POST",
  }) as unknown as NextRequest;
}

/** The API proxy's body cap, in bytes. */
const PROXY_BODY_LIMIT = 10_485_760;

function getRequest(authorization = "Bearer jwt") {
  return new Request("https://api.biso.no/api/recruitment/applications", {
    headers: authorization ? { authorization } : {},
  }) as unknown as NextRequest;
}

function applicationForm(fields: Record<string, string> = {}) {
  const form = new FormData();
  form.set("job_id", "job-1");
  form.set("applicant_name", "Kari Nordmann");
  form.set("gdpr_consent", "true");
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  return form;
}

interface SubmitDeps {
  extractPdfText: unknown;
  isMember: () => Promise<boolean>;
}

function submittedDeps(): SubmitDeps {
  return submitRecruitmentApplication.mock.calls[0]?.[1] as SubmitDeps;
}

describe("/api/recruitment/applications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    account.get.mockResolvedValue(USER);
    submitRecruitmentApplication.mockResolvedValue({
      applicationId: "application-1",
      screening: null,
      success: true,
    });
    listApplicationsForApplicant.mockResolvedValue([]);
  });

  it("401 without a bearer token", async () => {
    const post = await POST(postRequest(applicationForm(), ""));
    const get = await GET(getRequest(""));

    for (const response of [post, get]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: "Authentication required",
        success: false,
      });
    }
    expect(account.get).not.toHaveBeenCalled();
    expect(submitRecruitmentApplication).not.toHaveBeenCalled();
    expect(listApplicationsForApplicant).not.toHaveBeenCalled();
  });

  it("401 when Appwrite rejects the JWT or the account has no email", async () => {
    account.get.mockRejectedValueOnce(new Error("invalid jwt"));
    expect((await POST(postRequest(applicationForm()))).status).toBe(401);

    account.get.mockResolvedValueOnce({ ...USER, email: "" });
    expect((await GET(getRequest())).status).toBe(401);

    expect(submitRecruitmentApplication).not.toHaveBeenCalled();
    expect(listApplicationsForApplicant).not.toHaveBeenCalled();
  });

  it("takes the email from the account, not the form", async () => {
    await POST(
      postRequest(applicationForm({ applicant_email: "someone@else.no" }))
    );

    expect(submitRecruitmentApplication).toHaveBeenCalledWith(
      {
        applicant: {
          email: USER.email,
          name: USER.name,
          userId: USER.$id,
        },
        formData: expect.any(FormData),
        jobId: "job-1",
      },
      expect.objectContaining({ extractPdfText: extractTextFromPdf })
    );
  });

  it("400 invalid_data without a job id", async () => {
    const form = applicationForm();
    form.delete("job_id");

    const response = await POST(postRequest(form));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "invalid_data",
      error: "Invalid application data.",
      success: false,
    });
    expect(submitRecruitmentApplication).not.toHaveBeenCalled();
  });

  it("413 invalid_file when the body is over the proxy's 10 MB cap", async () => {
    const response = await POST(
      postRequest(applicationForm(), "Bearer jwt", {
        "content-length": String(PROXY_BODY_LIMIT + 1),
      })
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      code: "invalid_file",
      error:
        "Your files are too large together. Keep the CV and cover letter under 9 MB in total.",
      success: false,
    });
    expect(submitRecruitmentApplication).not.toHaveBeenCalled();
  });

  it("accepts a body of exactly 10 MB", async () => {
    const response = await POST(
      postRequest(applicationForm(), "Bearer jwt", {
        "content-length": String(PROXY_BODY_LIMIT),
      })
    );

    expect(response.status).toBe(201);
    expect(submitRecruitmentApplication).toHaveBeenCalledOnce();
  });

  it("maps each error code to its status", async () => {
    const expected = {
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

    for (const [code, status] of Object.entries(expected)) {
      submitRecruitmentApplication.mockResolvedValueOnce({
        code,
        error: `message for ${code}`,
        success: false,
      });

      const response = await POST(postRequest(applicationForm()));

      expect(response.status, code).toBe(status);
      expect(await response.json()).toEqual({
        code,
        error: `message for ${code}`,
        success: false,
      });
    }
    expect(after).not.toHaveBeenCalled();
  });

  it("201 with the application id", async () => {
    const response = await POST(postRequest(applicationForm()));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      applicationId: "application-1",
      success: true,
    });
    expect(after).not.toHaveBeenCalled();
  });

  it("screens after the response when the job asks for it", async () => {
    const screening = { applicationId: "application-1" };
    submitRecruitmentApplication.mockResolvedValueOnce({
      applicationId: "application-1",
      screening,
      success: true,
    });

    await POST(postRequest(applicationForm()));

    expect(after).toHaveBeenCalledOnce();
    expect(runRecruitmentScreening).not.toHaveBeenCalled();
    await after.mock.calls[0]?.[0]();
    expect(runRecruitmentScreening).toHaveBeenCalledWith(
      screening,
      screenApplication
    );
  });

  it("checks membership live from the profile's student number", async () => {
    getRow.mockResolvedValue({ $id: "user-1", student_id: "s1715738" });
    getMembershipStatusForStudent.mockResolvedValue({ isMember: true });

    await POST(postRequest(applicationForm()));

    expect(await submittedDeps().isMember()).toBe(true);
    expect(getRow).toHaveBeenCalledWith("app", "user", "user-1");
    expect(getMembershipStatusForStudent).toHaveBeenCalledWith(1_715_738, {
      refresh: true,
    });
  });

  it("treats a profile without a student number as not a member", async () => {
    getRow.mockResolvedValue({ $id: "user-1", student_id: null });

    await POST(postRequest(applicationForm()));

    expect(await submittedDeps().isMember()).toBe(false);
    expect(getMembershipStatusForStudent).not.toHaveBeenCalled();
  });

  it("lists the caller's applications by account email", async () => {
    const applications = [{ $id: "application-1", status: "submitted" }];
    listApplicationsForApplicant.mockResolvedValue(applications);

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ applications });
    expect(listApplicationsForApplicant).toHaveBeenCalledWith(USER.email);
  });

  it("500 when the applications cannot be read", async () => {
    listApplicationsForApplicant.mockRejectedValue(new Error("timeout"));

    const response = await GET(getRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to load applications",
      success: false,
    });
  });

  it("answers the CORS preflight", () => {
    const response = OPTIONS(getRequest());

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
      "POST"
    );
  });
});
