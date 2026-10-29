import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  GraphUserService: vi.fn(),
  getAdminScope: vi.fn(),
  getRow: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin-auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/admin-auth")>(
      "@/lib/admin-auth"
    );
  return {
    ...actual,
    createAuditLog: vi.fn(),
    extractJwtFromRequest: vi.fn(() => "jwt"),
    getAdminScope: mocks.getAdminScope,
  };
});
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: { createRow: vi.fn() } })),
  createSessionClient: vi.fn(async () => ({ db: { getRow: mocks.getRow } })),
}));
vi.mock("@repo/connectors/azure/users", () => ({
  GraphUserService: mocks.GraphUserService,
  generateTemporaryPassword: vi.fn(() => "pw"),
  generateUpn: vi.fn(() => "a.b@biso.no"),
  getRequiredSecurityGroups: vi.fn(() => []),
}));

const baseScope = {
  canManageAnyCampus: false,
  isCampusAdmin: false,
  isGlobalAdmin: false,
  managedCampusNames: [] as string[],
  managedDepartmentNames: [] as string[],
  userId: "u1",
};

const validBody = {
  campusId: "c1",
  departmentId: "d1",
  firstName: "Ada",
  lastName: "Lovelace",
};

function post(body: unknown) {
  return new Request("https://api.example/api/admin/users", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  }) as never;
}

async function loadPost() {
  vi.stubEnv("AZURE_GRAPH_TENANT_ID", "t");
  vi.stubEnv("AZURE_GRAPH_CLIENT_ID", "c");
  vi.stubEnv("AZURE_GRAPH_CLIENT_SECRET", "s");
  vi.resetModules();
  return (await import("./route")).POST;
}

describe("POST /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getRow.mockResolvedValue({ $id: "c1", name: "Oslo" });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses a department member", async () => {
    mocks.getAdminScope.mockResolvedValue({ ...baseScope });
    const POST = await loadPost();

    const response = await POST(post(validBody));

    expect(response.status).toBe(403);
    expect(mocks.GraphUserService).not.toHaveBeenCalled();
  });

  it("refuses a campus admin who adds extra groups", async () => {
    mocks.getAdminScope.mockResolvedValue({
      ...baseScope,
      isCampusAdmin: true,
      managedCampusNames: ["Oslo"],
    });
    const POST = await loadPost();

    const response = await POST(
      post({ ...validBody, additionalGroupIds: ["g1"] })
    );

    expect(response.status).toBe(403);
    expect(mocks.GraphUserService).not.toHaveBeenCalled();
  });

  it("refuses a campus admin creating in another campus", async () => {
    mocks.getAdminScope.mockResolvedValue({
      ...baseScope,
      isCampusAdmin: true,
      managedCampusNames: ["Bergen"],
    });
    const POST = await loadPost();

    const response = await POST(post(validBody));

    expect(response.status).toBe(403);
    expect(mocks.GraphUserService).not.toHaveBeenCalled();
  });

  it("lets a global admin add extra groups past the gates", async () => {
    mocks.getAdminScope.mockResolvedValue({
      ...baseScope,
      canManageAnyCampus: true,
      isGlobalAdmin: true,
    });
    const POST = await loadPost();

    const response = await POST(
      post({ ...validBody, additionalGroupIds: ["g1"] })
    );

    expect(response.status).not.toBe(403);
    expect(mocks.GraphUserService).toHaveBeenCalledTimes(1);
  });

  it("lets a campus admin create without extra groups in a campus they manage", async () => {
    mocks.getAdminScope.mockResolvedValue({
      ...baseScope,
      isCampusAdmin: true,
      managedCampusNames: ["Oslo"],
    });
    const POST = await loadPost();

    const response = await POST(post(validBody));

    expect(response.status).not.toBe(403);
    expect(mocks.GraphUserService).toHaveBeenCalledTimes(1);
  });
});
