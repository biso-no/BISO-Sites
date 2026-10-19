import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({ get: vi.fn() }));
const submitRecruitmentApplication = vi.hoisted(() => vi.fn());
const listApplicationsForApplicant = vi.hoisted(() => vi.fn());
const runRecruitmentScreening = vi.hoisted(() => vi.fn());
const getLiveMembershipStatus = vi.hoisted(() => vi.fn());
const after = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
const screenApplication = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@repo/api/server", () => ({
  createSessionClient: vi.fn(async () => ({ account })),
}));
vi.mock("@repo/ai/server/recruitment-screener", () => ({
  screenApplication,
}));
vi.mock("@repo/ai/server/pdf-text-extractor", () => ({
  extractTextFromPdf: vi.fn(),
}));
vi.mock("@repo/shared/recruitment/apply", () => ({
  listApplicationsForApplicant,
  runRecruitmentScreening,
  submitRecruitmentApplication,
}));
vi.mock("@/lib/actions/membership", () => ({ getLiveMembershipStatus }));

import { listMyApplications, submitJobApplication } from "./jobs";

const USER = {
  $id: "user-1",
  email: "kari.nordmann@student.bi.no",
  emailVerification: true,
  name: "Kari Nordmann",
};

describe("submitJobApplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    account.get.mockResolvedValue(USER);
    submitRecruitmentApplication.mockResolvedValue({
      applicationId: "application-1",
      screening: null,
      success: true,
    });
  });

  it("asks a guest session to sign in", async () => {
    account.get.mockResolvedValue({ ...USER, email: "", name: "guest_1" });

    expect(await submitJobApplication("job-1", new FormData())).toEqual({
      error: "You must sign in with a verified account before applying.",
      success: false,
    });
    expect(submitRecruitmentApplication).not.toHaveBeenCalled();
  });

  it("applies as the session user and checks membership live", async () => {
    getLiveMembershipStatus.mockResolvedValue({ isMember: true });
    const formData = new FormData();

    expect(await submitJobApplication("job-1", formData)).toEqual({
      applicationId: "application-1",
      success: true,
    });
    const [input, deps] = submitRecruitmentApplication.mock.calls[0] ?? [];
    expect(input).toEqual({
      applicant: { email: USER.email, name: USER.name, userId: USER.$id },
      formData,
      jobId: "job-1",
    });
    expect(await deps.isMember()).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/applications");
    expect(revalidatePath).toHaveBeenCalledWith("/jobs");
  });

  it("returns the shared failure's message without its code", async () => {
    submitRecruitmentApplication.mockResolvedValue({
      code: "already_applied",
      error: "You have already applied for this vacancy.",
      success: false,
    });

    expect(await submitJobApplication("job-1", new FormData())).toEqual({
      error: "You have already applied for this vacancy.",
      success: false,
    });
    expect(after).not.toHaveBeenCalled();
  });

  it("screens after the response", async () => {
    const screening = { applicationId: "application-1" };
    submitRecruitmentApplication.mockResolvedValue({
      applicationId: "application-1",
      screening,
      success: true,
    });

    await submitJobApplication("job-1", new FormData());

    expect(after).toHaveBeenCalledOnce();
    await after.mock.calls[0]?.[0]();
    expect(runRecruitmentScreening).toHaveBeenCalledWith(
      screening,
      screenApplication
    );
  });
});

describe("listMyApplications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    account.get.mockResolvedValue(USER);
  });

  it("lists the session user's applications", async () => {
    const applications = [{ $id: "application-1" }];
    listApplicationsForApplicant.mockResolvedValue(applications);

    expect(await listMyApplications()).toEqual(applications);
    expect(listApplicationsForApplicant).toHaveBeenCalledWith(USER.email);
  });

  it("shows an empty list when Appwrite cannot be read", async () => {
    listApplicationsForApplicant.mockRejectedValue(new Error("timeout"));

    expect(await listMyApplications()).toEqual([]);
  });
});
