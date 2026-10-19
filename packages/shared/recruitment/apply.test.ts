import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * In-memory stand-in for the admin client: rows per table (honouring `equal`
 * and `limit` queries), the permissions each row was written with, and the
 * files uploaded to storage.
 */
const fake = vi.hoisted(() => {
  type Row = Record<string, unknown> & { $id: string };
  interface ParsedQuery {
    attribute?: string;
    method: string;
    values?: unknown[];
  }

  const rows = new Map<string, Row[]>();
  const permissions = new Map<string, string[] | undefined>();
  const files: Array<{
    bucketId: string;
    fileId: string;
    permissions: string[] | undefined;
  }> = [];

  /** Runs `work` as an SDK call would: its throw becomes a rejection. */
  const settle = <T>(work: () => T): Promise<T> => {
    try {
      return Promise.resolve(work());
    } catch (error) {
      return Promise.reject(error);
    }
  };
  const table = (tableId: string): Row[] => {
    const existing = rows.get(tableId);
    if (existing) {
      return existing;
    }
    const created: Row[] = [];
    rows.set(tableId, created);
    return created;
  };
  const findRow = (tableId: string, rowId: string): Row => {
    const row = table(tableId).find((candidate) => candidate.$id === rowId);
    if (!row) {
      throw Object.assign(new Error("Row not found"), { code: 404 });
    }
    return row;
  };
  const parse = (queries: string[] = []): ParsedQuery[] =>
    queries.map((query) => JSON.parse(query) as ParsedQuery);
  const matches = (row: Row, queries: ParsedQuery[]) =>
    queries.every(
      (query) =>
        query.method !== "equal" ||
        (query.values ?? []).includes(row[query.attribute ?? ""])
    );

  const db = {
    createRow: vi.fn(
      (
        _databaseId: string,
        tableId: string,
        rowId: string,
        data: Record<string, unknown>,
        rowPermissions?: string[]
      ) =>
        settle(() => {
          const row: Row = {
            ...data,
            $createdAt: new Date().toISOString(),
            $id: rowId,
          };
          table(tableId).push(row);
          permissions.set(`${tableId}/${rowId}`, rowPermissions);
          return row;
        })
    ),
    getRow: vi.fn((_databaseId: string, tableId: string, rowId: string) =>
      settle(() => findRow(tableId, rowId))
    ),
    listRows: vi.fn(
      (_databaseId: string, tableId: string, queries?: string[]) =>
        settle(() => {
          const parsed = parse(queries);
          const found = table(tableId).filter((row) => matches(row, parsed));
          const limit = parsed.find((query) => query.method === "limit")
            ?.values?.[0] as number | undefined;
          return {
            rows: limit === undefined ? found : found.slice(0, limit),
            total: found.length,
          };
        })
    ),
    updateRow: vi.fn(
      (
        _databaseId: string,
        tableId: string,
        rowId: string,
        data: Record<string, unknown>,
        rowPermissions?: string[]
      ) =>
        settle(() => {
          const row = findRow(tableId, rowId);
          Object.assign(row, data);
          if (rowPermissions) {
            permissions.set(`${tableId}/${rowId}`, rowPermissions);
          }
          return row;
        })
    ),
  };

  const storage = {
    createFile: vi.fn(
      (
        bucketId: string,
        fileId: string,
        _file: unknown,
        filePermissions?: string[]
      ) =>
        settle(() => {
          files.push({ bucketId, fileId, permissions: filePermissions });
          return { $id: fileId };
        })
    ),
  };

  const reset = () => {
    rows.clear();
    permissions.clear();
    files.length = 0;
  };

  return { db, files, permissions, reset, storage, table };
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({
    db: fake.db,
    storage: fake.storage,
  })),
}));

import { buildRecruitmentStaffRowPermissions } from "@repo/shared/recruitment";
import {
  listApplicationsForApplicant,
  type RecruitmentApplyDeps,
  runRecruitmentScreening,
  submitRecruitmentApplication,
} from "./apply";

const STAFF_ONLY = buildRecruitmentStaffRowPermissions();
const APPLICANT = {
  email: "kari.nordmann@student.bi.no",
  name: "Kari Nordmann",
  userId: "user-1",
};
const COVER_LETTER_TEXT = "text of cover-letter.pdf";
const CV_TEXT = "text of cv.pdf";

function seedJob(
  overrides: {
    custom_questions?: unknown;
    metadata?: Record<string, unknown>;
    status?: string;
  } = {}
) {
  fake.table("jobs").push({
    $createdAt: "2026-09-01T00:00:00.000Z",
    $id: "job-1",
    $updatedAt: "2026-09-01T00:00:00.000Z",
    application_deadline: null,
    auto_screen: true,
    campus: { $id: "1", name: "Oslo" },
    campus_id: "1",
    custom_questions:
      overrides.custom_questions ??
      JSON.stringify([
        { id: "q1", label: "Why us?", required: true, type: "long_text" },
      ]),
    department: null,
    department_id: null,
    interview_template: null,
    metadata: JSON.stringify({
      audience: "public",
      cv_required: true,
      ...overrides.metadata,
    }),
    screening_rubric: null,
    slug: "event-lead",
    status: overrides.status ?? "published",
    translations: [
      {
        $id: "translation-no",
        additional_fields: null,
        description: "Lead the events team",
        locale: "no",
        short_description: null,
        title: "Eventleder",
      },
    ],
  });
}

/** A file whose bytes are its "extracted text", so each PDF reads back distinctly. */
function pdf(name: string, type = "application/pdf") {
  return new File([`text of ${name}`], name, { type });
}

function applicationForm(overrides: Record<string, string | File | null> = {}) {
  const fields: Record<string, string | File | null> = {
    "answer.q1": "Because I love running events",
    "answer_label.q1": "Why us?",
    "answer_type.q1": "long_text",
    applicant_name: "Kari Nordmann",
    applicant_phone: "+4791234567",
    availability: "Mondays\nThursday evenings",
    cover_letter: pdf("cover-letter.pdf"),
    gdpr_consent: "true",
    resume: pdf("cv.pdf"),
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) {
      form.set(key, value);
    }
  }
  return form;
}

function makeDeps(isMember = true) {
  return {
    extractPdfText: vi.fn(async (buffer: Buffer) => buffer.toString("utf8")),
    isMember: vi.fn(async () => isMember),
  } satisfies RecruitmentApplyDeps;
}

function submit(
  formData = applicationForm(),
  deps: RecruitmentApplyDeps = makeDeps()
) {
  return submitRecruitmentApplication(
    { applicant: APPLICANT, formData, jobId: "job-1" },
    deps
  );
}

function expectNothingStored() {
  expect(fake.files).toEqual([]);
  expect(fake.table("job_applications")).toEqual([]);
  expect(fake.table("job_application_answers")).toEqual([]);
  expect(fake.table("candidate_profiles")).toEqual([]);
}

describe("submitRecruitmentApplication", () => {
  beforeEach(() => {
    fake.reset();
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a closed vacancy", async () => {
    seedJob({ status: "closed" });

    expect(await submit()).toEqual({
      code: "vacancy_closed",
      error: "This vacancy is not accepting applications.",
      success: false,
    });
    expectNothingStored();
  });

  it("rejects a vacancy that does not exist", async () => {
    expect(await submit()).toMatchObject({
      code: "vacancy_closed",
      success: false,
    });
    expectNothingStored();
  });

  it("asks a non-member for membership on a members-only job", async () => {
    seedJob({ metadata: { audience: "members" } });
    const deps = makeDeps(false);

    expect(await submit(applicationForm(), deps)).toEqual({
      code: "members_only",
      error:
        "This vacancy is open to BISO members only. Buy a membership to apply.",
      success: false,
    });
    expect(deps.isMember).toHaveBeenCalledOnce();
    expectNothingStored();
  });

  it("requires every required custom answer", async () => {
    seedJob();

    expect(await submit(applicationForm({ "answer.q1": "   " }))).toEqual({
      code: "answer_required",
      error: 'Answer required for "Why us?"',
      success: false,
    });
    expectNothingStored();
  });

  it("requires a CV when the job says so", async () => {
    seedJob();

    expect(await submit(applicationForm({ resume: null }))).toEqual({
      code: "cv_required",
      error: "A CV is required for this vacancy.",
      success: false,
    });
    expectNothingStored();
  });

  it("requires a PDF cover letter", async () => {
    seedJob();

    expect(await submit(applicationForm({ cover_letter: null }))).toEqual({
      code: "cover_letter_required",
      error: "A cover letter (PDF) is required.",
      success: false,
    });
    expect(
      await submit(
        applicationForm({
          cover_letter: pdf("cover-letter.docx", "text/plain"),
        })
      )
    ).toEqual({
      code: "invalid_file",
      error: "The file must be a PDF",
      success: false,
    });
    expectNothingStored();
  });

  it("rejects a CV that is not a PDF before uploading anything", async () => {
    seedJob();

    expect(
      await submit(applicationForm({ resume: pdf("cv.png", "image/png") }))
    ).toEqual({
      code: "invalid_file",
      error: "Resume must be a PDF file",
      success: false,
    });
    expectNothingStored();
  });

  it("rejects a phone longer than 20 characters before uploading anything", async () => {
    seedJob();

    const result = await submit(
      applicationForm({ applicant_phone: "+47 912 34 567 ext 12" })
    );

    expect(result).toMatchObject({ code: "invalid_data", success: false });
    expectNothingStored();
  });

  it("a second application to the same job is refused", async () => {
    seedJob();
    expect(await submit()).toMatchObject({ success: true });
    const filesAfterFirst = fake.files.length;

    expect(await submit()).toEqual({
      code: "already_applied",
      error: "You have already applied for this vacancy.",
      success: false,
    });
    expect(fake.table("job_applications")).toHaveLength(1);
    expect(fake.table("job_application_answers")).toHaveLength(1);
    expect(fake.files).toHaveLength(filesAfterFirst);
  });

  it("stores each PDF under a name ending in .pdf", async () => {
    // The bucket allows the `pdf` extension only; validation checks the MIME
    // type, so a PDF named "CV" would otherwise pass and then fail to upload.
    seedJob();

    const result = await submit(
      applicationForm({
        cover_letter: pdf("Cover letter.PDF"),
        resume: pdf("CV"),
      })
    );

    expect(result).toMatchObject({ success: true });
    expect(
      fake.storage.createFile.mock.calls.map(
        ([, , file]) => (file as { filename: string }).filename
      )
    ).toEqual(["CV.pdf", "Cover letter.pdf"]);
  });

  it("stores files, application and answers with staff-only permissions", async () => {
    seedJob();
    const deps = makeDeps();

    const result = await submit(applicationForm(), deps);

    const [application] = fake.table("job_applications");
    expect(result).toMatchObject({
      applicationId: application?.$id,
      success: true,
    });
    expect(application).toMatchObject({
      applicant_email: APPLICANT.email,
      applicant_name: "Kari Nordmann",
      applicant_phone: "+4791234567",
      cover_letter: COVER_LETTER_TEXT,
      gdpr_consent: true,
      job_id: "job-1",
      source: "public_apply",
      status: "submitted",
    });
    expect(
      JSON.parse(String(application?.review_metadata)).candidate_availability
    ).toEqual(["Mondays", "Thursday evenings"]);

    // Both PDFs land in the resumes bucket with no grant of their own: only
    // the admin key (staff tooling) reads them.
    expect(fake.files.map((file) => file.bucketId)).toEqual([
      "resumes",
      "resumes",
    ]);
    expect(fake.files.map((file) => file.permissions)).toEqual([
      undefined,
      undefined,
    ]);
    expect([
      application?.resume_file_id,
      application?.cover_letter_file_id,
    ]).toEqual(fake.files.map((file) => file.fileId));

    const answers = fake.table("job_application_answers");
    expect(answers).toEqual([
      expect.objectContaining({
        answer: "Because I love running events",
        application_id: application?.$id,
        job_id: "job-1",
        question_id: "q1",
        question_label: "Why us?",
      }),
    ]);
    const [profile] = fake.table("candidate_profiles");
    expect(profile).toMatchObject({ email: APPLICANT.email });

    for (const key of [
      `job_applications/${application?.$id}`,
      `job_application_answers/${answers[0]?.$id}`,
      `candidate_profiles/${profile?.$id}`,
    ]) {
      expect(fake.permissions.get(key)).toEqual(STAFF_ONLY);
    }
    // A public vacancy never asks about membership.
    expect(deps.isMember).not.toHaveBeenCalled();
  });

  it("uses the account name when the form leaves the name blank", async () => {
    seedJob();

    await submit(applicationForm({ applicant_name: "" }));

    expect(fake.table("job_applications")[0]).toMatchObject({
      applicant_name: APPLICANT.name,
    });
  });

  it("hands back a screening job only when auto-screening is on", async () => {
    seedJob();
    const screened = await submit();
    expect(screened).toMatchObject({
      screening: { applicationId: expect.any(String) },
      success: true,
    });

    fake.reset();
    seedJob({ metadata: { auto_screen: false } });
    expect(await submit()).toMatchObject({ screening: null, success: true });
  });
});

describe("runRecruitmentScreening", () => {
  beforeEach(() => {
    fake.reset();
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("writes the screening and its 0-100 score onto the application", async () => {
    seedJob();
    const result = await submit();
    if (!(result.success && result.screening)) {
      throw new Error("expected a screening job");
    }
    const screening = {
      concerns: [],
      dimension_scores: [],
      generated_at: "2026-10-19T08:00:00.000Z",
      model: "test-model",
      must_have_matches: [],
      must_have_missing: [],
      normalized_score: 71.6,
      overall_score: 4,
      recommended_status: "interview" as const,
      red_flags: [],
      strengths: ["Event experience"],
      summary: "Strong fit.",
      version: 1 as const,
    };
    const screen = vi.fn(async () => screening);

    await runRecruitmentScreening(result.screening, screen);

    expect(screen).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: [
          {
            answer: "Because I love running events",
            question_label: "Why us?",
          },
        ],
        application: expect.objectContaining({
          $id: result.applicationId,
          applicant_name: "Kari Nordmann",
          cover_letter: COVER_LETTER_TEXT,
        }),
        resumeText: CV_TEXT,
      })
    );
    expect(fake.table("job_applications")[0]).toMatchObject({
      ai_screening: JSON.stringify(screening),
      screening_score: 72,
    });
  });

  it("swallows a screening failure", async () => {
    seedJob();
    const result = await submit();
    if (!(result.success && result.screening)) {
      throw new Error("expected a screening job");
    }

    await expect(
      runRecruitmentScreening(
        result.screening,
        vi.fn(() => Promise.reject(new Error("model down")))
      )
    ).resolves.toBeUndefined();
  });
});

describe("listApplicationsForApplicant", () => {
  beforeEach(() => {
    fake.reset();
  });

  it("lists only the applicant's own applications", async () => {
    seedJob();
    const base = {
      cover_letter: null,
      data_retention_until: "2027-04-01T00:00:00.000Z",
      job_id: "job-1",
      resume_file_id: null,
      review_metadata: null,
    };
    fake.table("job_applications").push(
      {
        ...base,
        $createdAt: "2026-10-01T00:00:00.000Z",
        $id: "app-kari",
        applicant_email: APPLICANT.email,
        review_metadata: JSON.stringify({
          assigned_hr_user_name: "Hanne HR",
        }),
        status: "interview",
      },
      {
        ...base,
        $createdAt: "2026-10-02T00:00:00.000Z",
        $id: "app-ola",
        applicant_email: "ola.nordmann@student.bi.no",
        status: "submitted",
      }
    );
    fake.table("job_interviews").push({
      $id: "interview-1",
      application_id: "app-kari",
      ends_at: "2099-01-01T11:00:00.000Z",
      location: "B4-021",
      meeting_url: null,
      starts_at: "2099-01-01T10:00:00.000Z",
      status: "scheduled",
      title: "First interview",
    });
    fake.table("job_application_answers").push(
      {
        $id: "answer-kari",
        answer: "Because I love running events",
        application_id: "app-kari",
        question_label: "Why us?",
      },
      {
        $id: "answer-ola",
        answer: "Free pizza",
        application_id: "app-ola",
        question_label: "Why us?",
      }
    );

    const applications = await listApplicationsForApplicant(APPLICANT.email);

    expect(applications).toEqual([
      {
        $createdAt: "2026-10-01T00:00:00.000Z",
        $id: "app-kari",
        answers: [
          {
            answer: "Because I love running events",
            question_label: "Why us?",
          },
        ],
        cover_letter: null,
        data_retention_until: "2027-04-01T00:00:00.000Z",
        hr_assigned_name: "Hanne HR",
        job: {
          $id: "job-1",
          campus_name: "Oslo",
          slug: "event-lead",
          title: "Eventleder",
        },
        next_interview: {
          $id: "interview-1",
          ends_at: "2099-01-01T11:00:00.000Z",
          location: "B4-021",
          meeting_url: null,
          starts_at: "2099-01-01T10:00:00.000Z",
          status: "scheduled",
          title: "First interview",
        },
        resume_file_id: null,
        status: "interview",
      },
    ]);
  });

  it("returns nothing for an applicant without applications", async () => {
    expect(await listApplicationsForApplicant(APPLICANT.email)).toEqual([]);
  });
});
