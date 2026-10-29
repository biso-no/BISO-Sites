import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getAdminScope: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  createAuditLog: vi.fn(),
  getAdminScope: mocks.getAdminScope,
}));
vi.mock("./appwrite-invalidation", () => ({
  invalidateAppwriteUser: vi.fn(),
}));

const baseScope = {
  canManageAnyCampus: false,
  isCampusAdmin: false,
  isGlobalAdmin: false,
  managedCampusNames: [] as string[],
  managedDepartmentNames: [] as string[],
  userId: "u1",
};

const body = {
  incomingUserUpn: "new@biso.no",
  roleMailboxUpn: "role@biso.no",
};

function post() {
  return new Request("https://api.example/api/admin/account-turnover", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  }) as never;
}

async function loadPost() {
  vi.stubEnv("AZURE_ACCOUNT_TURNOVER_WEBHOOK_URL", "");
  vi.resetModules();
  return (await import("./route")).POST;
}

describe("POST /api/admin/account-turnover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("refuses a campus admin", async () => {
    mocks.getAdminScope.mockResolvedValue({
      ...baseScope,
      isCampusAdmin: true,
      managedCampusNames: ["Oslo"],
    });
    const POST = await loadPost();

    const response = await POST(post());

    expect(response.status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("refuses a department member", async () => {
    mocks.getAdminScope.mockResolvedValue({ ...baseScope });
    const POST = await loadPost();

    const response = await POST(post());

    expect(response.status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("lets a global admin through to the configuration check", async () => {
    mocks.getAdminScope.mockResolvedValue({
      ...baseScope,
      canManageAnyCampus: true,
      isGlobalAdmin: true,
    });
    const POST = await loadPost();

    const response = await POST(post());

    expect(response.status).toBe(500);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
