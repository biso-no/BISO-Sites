/**
 * End-to-end protocol tests.
 *
 * These drive a real `Client` from the MCP SDK against a real server over an
 * in-memory transport pair: initialization, capability negotiation, tool and
 * resource discovery, tool calls, and error shapes all go through the actual
 * protocol rather than calling handlers directly. A handler-level test would
 * not catch a malformed schema, a name collision, or a result the SDK refuses
 * to serialise.
 *
 * No network is involved: the backend is the in-memory fake, and no AI provider
 * is configured, which also exercises the "works without provider credentials"
 * requirement.
 */

import { describe, expect, setSystemTime, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createBackendClients } from "./appwrite/clients";
import { loadConfig, type ServerConfig } from "./config/env";
import type { Principal } from "./identity/principal";
import { PRINCIPAL_TTL_MS } from "./identity/refresh";
import { createBisoMcpServer } from "./server";
import {
  ANONYMOUS,
  CAMPUS_ADMIN,
  collectingLogger,
  createFakeBackend,
  DEPARTMENT_MEMBER,
  type FakeRow,
  type FakeTables,
  GLOBAL_ADMIN,
  HR_MEMBER,
  MEMBER_ONLY,
} from "./testing/index";

const BISO_RE = /^biso_/;
const NO_USER_CREDENTIAL_I_RE = /no user credential/i;
const OSLO_RE = /Oslo/;
const NOT_VALID_FOR_NEWS_I_RE = /not valid for news/i;
const SHAREPOINT_I_RE = /SharePoint/i;
const BERGEN_I_RE = /Bergen/i;
const ELICITATION_I_RE = /elicitation/i;
const DOMAIN_I_RE = /domain/i;
const BISO_WHOAMI_RE = /biso_whoami/;
const NO_LANGUAGE_MODEL_I_RE = /no language model/i;
const SERVICE_KEY_CLIENT_WHICH_IS_NOT_CONF_RE =
  /service-key client, which is not configured/i;
const MEMBER_PRICE_I_RE = /member price/i;
const EXPIRED_I_RE = /has expired/i;

function baseConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  const config = loadConfig({
    BISO_MCP_APPWRITE_ENDPOINT: "https://appwrite.example/v1",
    BISO_MCP_APPWRITE_PROJECT: "test",
    BISO_MCP_LOG_LEVEL: "silent",
  });
  return { ...config, ...overrides };
}

function seedTables(): FakeTables {
  return {
    campus: [
      { $id: "1", name: "Oslo" },
      { $id: "2", name: "Bergen" },
      { $id: "5", name: "National" },
    ],
    departments: [
      {
        $id: "dept-a",
        Name: "ESN Oslo",
        campus_id: "1",
        slug: "esn",
        type: "unit",
        active: true,
      },
      {
        $id: "dept-b",
        Name: "ESN Bergen",
        campus_id: "2",
        slug: "esn",
        type: "unit",
        active: true,
      },
      {
        $id: "dept-ledger",
        Name: "Drift Campus Oslo",
        campus_id: "1",
        slug: "drift",
        type: "ledger",
        active: true,
      },
    ],
    feature_flags: [{ $id: "f1", key: "payments_stripe", enabled: false }],
    news: [
      {
        $id: "news-oslo",
        $createdAt: "2026-01-01T00:00:00.000Z",
        $updatedAt: "2026-01-01T00:00:00.000Z",
        slug: "oslo-news",
        status: "published",
        campus_id: "1",
        department_id: "dept-a",
        campus: { $id: "1" },
        department: { $id: "dept-a" },
        translation_refs: [
          { locale: "no", title: "Oslo-nyhet" },
          { locale: "en", title: "Oslo news" },
        ],
      },
      {
        $id: "news-bergen",
        $createdAt: "2026-01-02T00:00:00.000Z",
        $updatedAt: "2026-01-02T00:00:00.000Z",
        slug: "bergen-news",
        status: "draft",
        campus_id: "2",
        department_id: "dept-b",
        campus: { $id: "2" },
        department: { $id: "dept-b" },
        translation_refs: [{ locale: "no", title: "Bergen-nyhet" }],
      },
    ],
    approval_requests: [],
    form_submissions: [],
    audit_logs: [],
  };
}

interface Harness {
  backend: ReturnType<typeof createFakeBackend>;
  client: Client;
  close(): Promise<void>;
  lines: string[];
}

async function connect(options: {
  principal?: Principal;
  config?: ServerConfig;
  tables?: FakeTables;
  hasElevated?: boolean;
  clientCapabilities?: Record<string, unknown>;
  /**
   * Memberships for the server to derive the principal from, instead of being
   * handed one.
   *
   * `principalOverride` marks the cache `fixed`, which switches re-resolution
   * off entirely — correct for an injected identity, but it means a harness
   * built on it cannot exercise a membership change at all.
   */
  resolveFrom?: {
    account: { $id: string; email?: string; name?: string };
    teams: Array<{ $id: string; name: string }>;
  };
  /** Throw from here to simulate a write that was dispatched and then failed. */
  onWrite?: (op: "create" | "update" | "upsert", table: string) => void;
  /** Throw from here to simulate a backend that is partially unavailable. */
  onRead?: (table: string) => void;
}): Promise<Harness> {
  const { logger, lines } = collectingLogger();
  const backend = createFakeBackend({
    tables: options.tables ?? seedTables(),
    hasElevated: options.hasElevated ?? true,
    account: options.resolveFrom?.account,
    teams: options.resolveFrom?.teams,
    onWrite: options.onWrite,
    onRead: options.onRead,
  });

  const config = options.config ?? baseConfig();
  // The fake backend goes in BEFORE registration: `isAvailable` reads
  // `hasElevated`, so injecting it afterwards would leave every write tool
  // unregistered and silently turn the mutation tests into no-ops.
  const created = await createBisoMcpServer({
    config,
    logger,
    principalOverride: options.principal,
    clientsOverride: backend,
  });

  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: options.clientCapabilities ?? {} }
  );
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    created.server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return {
    client,
    lines,
    backend,
    close: async () => {
      await client.close();
      await created.server.close();
    },
  };
}

/**
 * Writes excluding `audit_logs`.
 *
 * Every successful mutating call also writes an audit row, which is correct but
 * is not the write under test — asserting on the raw list would make "nothing
 * was written" fail for the wrong reason.
 */
function domainWrites(harness: Harness) {
  return harness.backend.writes.filter((write) => write.table !== "audit_logs");
}

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {}
) {
  const response = await client.callTool({ name, arguments: args });
  const structured = response.structuredContent as
    | Record<string, unknown>
    | undefined;
  return { response, structured };
}

describe("initialization and discovery", () => {
  test("initializes and advertises tools, resources and prompts", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const tools = await harness.client.listTools();
      expect(tools.tools.length).toBeGreaterThan(10);

      const resources = await harness.client.listResources();
      expect(resources.resources.length).toBeGreaterThan(0);

      const prompts = await harness.client.listPrompts();
      expect(prompts.prompts.length).toBeGreaterThan(0);
    } finally {
      await harness.close();
    }
  });

  test("every tool has a unique name, a description and annotations", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const { tools } = await harness.client.listTools();
      const names = tools.map((tool) => tool.name);
      expect(new Set(names).size).toBe(names.length);
      for (const tool of tools) {
        expect(tool.description).toBeTruthy();
        expect(tool.annotations).toBeDefined();
        expect(tool.name).toMatch(BISO_RE);
      }
    } finally {
      await harness.close();
    }
  });

  test("read-only annotations match the tools that actually mutate", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const { tools } = await harness.client.listTools();
      const mutating = tools.filter(
        (tool) => tool.annotations?.readOnlyHint !== true
      );
      // Each mutating tool must take the proposal arguments, which is what
      // makes its write path go through the gate.
      for (const tool of mutating) {
        const properties = (
          tool.inputSchema as { properties?: Record<string, unknown> }
        ).properties;
        expect(properties).toHaveProperty("proposalToken");
      }
      expect(mutating.length).toBeGreaterThan(0);
    } finally {
      await harness.close();
    }
  });
});

describe("tool registration follows the profile", () => {
  test("an anonymous principal gets only public tools", async () => {
    const harness = await connect({ principal: ANONYMOUS() });
    try {
      const { tools } = await harness.client.listTools();
      const names = tools.map((tool) => tool.name);
      expect(names).toContain("biso_public_search");
      expect(names).toContain("biso_whoami");
      // No staff surface at all.
      expect(names).not.toContain("biso_content_search");
      expect(names).not.toContain("biso_page_load");
      expect(names).not.toContain("biso_search_orders");
      // Nothing that mutates.
      expect(
        tools.every((tool) => tool.annotations?.readOnlyHint === true)
      ).toBe(true);
    } finally {
      await harness.close();
    }
  });

  test("a plain member gets no staff tools", async () => {
    const harness = await connect({ principal: MEMBER_ONLY() });
    try {
      const names = (await harness.client.listTools()).tools.map((t) => t.name);
      expect(names).toContain("biso_public_search");
      expect(names).not.toContain("biso_content_search");
      expect(names).not.toContain("biso_list_pending_approvals");
    } finally {
      await harness.close();
    }
  });

  test("recruitment tools are NOT registered for a non-HR department member", async () => {
    // The admin assistant advertises vacancy tools to any department member;
    // its backend then returns an empty list. Here they are simply absent.
    const harness = await connect({ principal: DEPARTMENT_MEMBER() });
    try {
      const names = (await harness.client.listTools()).tools.map((t) => t.name);
      expect(names).not.toContain("biso_list_vacancies");
      expect(names).not.toContain("biso_list_applications");
    } finally {
      await harness.close();
    }
  });

  test("recruitment tools ARE registered for HR", async () => {
    const harness = await connect({ principal: HR_MEMBER() });
    try {
      const names = (await harness.client.listTools()).tools.map((t) => t.name);
      expect(names).toContain("biso_list_vacancies");
      expect(names).toContain("biso_list_applications");
    } finally {
      await harness.close();
    }
  });

  test("platform tools are global-admin only", async () => {
    const asAdmin = await connect({ principal: GLOBAL_ADMIN() });
    const asCampus = await connect({ principal: CAMPUS_ADMIN() });
    try {
      expect(
        (await asAdmin.client.listTools()).tools.map((t) => t.name)
      ).toContain("biso_integration_configuration");
      expect(
        (await asCampus.client.listTools()).tools.map((t) => t.name)
      ).not.toContain("biso_integration_configuration");
    } finally {
      await asAdmin.close();
      await asCampus.close();
    }
  });

  test("a tool stops being callable when the profile behind it is revoked", async () => {
    // Registration is a snapshot: the client fetched this tool list at connect
    // time and the SDK keeps every registered tool callable for the life of
    // the connection. A stdio server lives as long as its host, so that
    // snapshot can outlast the membership it was built from by hours.
    //
    // `biso_integration_configuration` is the sharp case because its handler
    // takes no principal at all — `profiles` was the only gate — so nothing
    // downstream would catch the revocation.
    const teams = [
      { $id: "SG-App-Dept-OperationsUnit", name: "SG-App-Dept-OperationsUnit" },
      { $id: "SG-App-Campus-National", name: "SG-App-Campus-National" },
    ];
    const harness = await connect({
      resolveFrom: { account: { $id: "u-1", email: "admin@biso.no" }, teams },
    });
    try {
      // Registered, which is also the proof that these memberships really did
      // resolve to the operator profile.
      expect(
        (await harness.client.listTools()).tools.map((t) => t.name)
      ).toContain("biso_integration_configuration");

      // Revoke, then step past the read TTL so the next call re-resolves.
      teams.length = 0;
      setSystemTime(new Date(Date.now() + PRINCIPAL_TTL_MS + 1000));

      const denied = await harness.client.callTool({
        name: "biso_integration_configuration",
        arguments: {},
      });

      expect(denied.isError).toBe(true);
      expect(
        (denied.structuredContent as { error: { code: string } }).error.code
      ).toBe("forbidden");
    } finally {
      setSystemTime();
      await harness.close();
    }
  });

  test("a revoked role does not survive the read TTL on a privileged read", async () => {
    // The test above steps past the TTL, which is the easy half. The window
    // inside it is the one that matters here: an ordinary read is gated twice
    // — by this package and by Appwrite applying the caller's credential to
    // the query — so a briefly stale principal costs nothing. Neither of these
    // two tools has that second gate. `biso_integration_configuration` takes
    // no principal at all, and `biso_event_audience` reads `event_attendees`
    // and `segment_members` through the service key, which belongs to no user
    // and carries no revocation. For both, this check is the only one, so the
    // refresh is forced and the clock is deliberately left alone.
    const teams = [
      { $id: "SG-App-Dept-OperationsUnit", name: "SG-App-Dept-OperationsUnit" },
      { $id: "SG-App-Campus-National", name: "SG-App-Campus-National" },
    ];
    const harness = await connect({
      resolveFrom: { account: { $id: "u-1", email: "admin@biso.no" }, teams },
      tables: {
        events: [
          {
            $id: "e-1",
            status: "published",
            campus_id: "1",
            slug: "e-1",
            title: "Kickoff",
          },
        ],
        campus: [{ $id: "1", name: "Oslo" }],
      },
    });
    try {
      teams.length = 0;

      for (const name of [
        "biso_integration_configuration",
        "biso_event_audience",
      ]) {
        const denied = await harness.client.callTool({
          name,
          arguments: name === "biso_event_audience" ? { eventId: "e-1" } : {},
        });
        expect(denied.isError).toBe(true);
        expect(
          (denied.structuredContent as { error: { code: string } }).error.code
        ).toBe("forbidden");
      }
    } finally {
      await harness.close();
    }
  });

  test("write tools are not registered without a service key", async () => {
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      hasElevated: false,
    });
    try {
      const names = (await harness.client.listTools()).tools.map((t) => t.name);
      expect(names).not.toContain("biso_content_create_draft");
      expect(names).not.toContain("biso_page_edit_blocks");
      // Reads are unaffected.
      expect(names).toContain("biso_content_search");
    } finally {
      await harness.close();
    }
  });
});

describe("biso_whoami", () => {
  test("reports the principal and never accepts an identity argument", async () => {
    const harness = await connect({ principal: CAMPUS_ADMIN("Oslo", "1") });
    try {
      const { structured } = await callTool(harness.client, "biso_whoami");
      const data = structured?.data as Record<string, unknown>;
      const principal = data.principal as Record<string, unknown>;
      expect(principal.roles).toContain("campusadmin");
      expect(principal.managedCampusIds).toEqual(["1"]);

      // The tool takes no arguments at all, so there is nothing to spoof.
      const { tools } = await harness.client.listTools();
      const whoami = tools.find((tool) => tool.name === "biso_whoami");
      const properties = (
        whoami?.inputSchema as { properties?: Record<string, unknown> }
      ).properties;
      expect(properties ?? {}).toEqual({});
    } finally {
      await harness.close();
    }
  });

  test("an anonymous session says so rather than implying an empty database", async () => {
    const harness = await connect({ principal: ANONYMOUS() });
    try {
      const { structured } = await callTool(harness.client, "biso_whoami");
      expect(String(structured?.summary)).toMatch(NO_USER_CREDENTIAL_I_RE);
      expect(
        (
          (structured?.data as Record<string, unknown>).principal as Record<
            string,
            unknown
          >
        ).authenticated
      ).toBe(false);
    } finally {
      await harness.close();
    }
  });
});

describe("scoped reads", () => {
  test("a campus admin sees only their campus's content", async () => {
    const harness = await connect({ principal: CAMPUS_ADMIN("Oslo", "1") });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_content_search",
        { domain: "news" }
      );
      const items = (structured?.data as { items: Array<{ id: string }> })
        .items;
      expect(items.map((item) => item.id)).toEqual(["news-oslo"]);
      // And the scope is stated, so an empty result is never ambiguous.
      expect(
        String((structured?.scope as { summary: string }).summary)
      ).toMatch(OSLO_RE);
    } finally {
      await harness.close();
    }
  });

  test("a global admin sees every campus", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_content_search",
        { domain: "news" }
      );
      const items = (structured?.data as { items: Array<{ id: string }> })
        .items;
      expect(items).toHaveLength(2);
    } finally {
      await harness.close();
    }
  });

  test("a campusId argument cannot widen scope", async () => {
    // Asking for Bergen as an Oslo admin returns nothing, not Bergen's rows.
    const harness = await connect({ principal: CAMPUS_ADMIN("Oslo", "1") });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_content_search",
        { domain: "news", campusId: "2" }
      );
      const items = (structured?.data as { items: unknown[] }).items;
      expect(items).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });

  test("a cross-scope id substitution reports not_found, not forbidden", async () => {
    // Distinguishing the two would confirm the id exists.
    const harness = await connect({ principal: CAMPUS_ADMIN("Oslo", "1") });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_content_get",
        {
          domain: "news",
          id: "news-bergen",
        }
      );
      expect(structured?.ok).toBe(false);
      expect((structured?.error as { code: string }).code).toBe("not_found");
    } finally {
      await harness.close();
    }
  });

  test("limit is honoured and pagination is reported", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_content_search",
        { domain: "news", limit: 1 }
      );
      const items = (structured?.data as { items: unknown[] }).items;
      expect(items).toHaveLength(1);
      const pagination = structured?.pagination as {
        hasMore: boolean;
        nextCursor: string | null;
        total: number;
      };
      expect(pagination.total).toBe(2);
      expect(pagination.hasMore).toBe(true);
      expect(pagination.nextCursor).toBeTruthy();
    } finally {
      await harness.close();
    }
  });

  test("a continuation cursor returns the next page", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const first = await callTool(harness.client, "biso_content_search", {
        domain: "news",
        limit: 1,
      });
      const cursor = (first.structured?.pagination as { nextCursor: string })
        .nextCursor;
      const second = await callTool(harness.client, "biso_content_search", {
        domain: "news",
        limit: 1,
        cursor,
      });
      const firstIds = (
        first.structured?.data as { items: Array<{ id: string }> }
      ).items.map((item) => item.id);
      const secondIds = (
        second.structured?.data as { items: Array<{ id: string }> }
      ).items.map((item) => item.id);
      expect(secondIds[0]).not.toBe(firstIds[0]);
    } finally {
      await harness.close();
    }
  });

  test("an invalid status is warned about, not silently dropped", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_content_search",
        { domain: "news", status: "archived" }
      );
      expect(structured?.warnings).toBeDefined();
      expect(String((structured?.warnings as string[]).join(" "))).toMatch(
        NOT_VALID_FOR_NEWS_I_RE
      );
    } finally {
      await harness.close();
    }
  });
});

describe("unsupported operations report why", () => {
  test("creating a document says what is missing", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_explain_permission",
        { domain: "documents", operation: "create_draft" }
      );
      const data = structured?.data as {
        allowed: boolean;
        reasons: string[];
      };
      expect(data.allowed).toBe(false);
      expect(data.reasons.join(" ")).toMatch(SHAREPOINT_I_RE);
    } finally {
      await harness.close();
    }
  });

  test("the explainer applies the campus check the gate applies", async () => {
    // `assertWriteAccess` rejects a campus outside `resolvedCampusIds` BEFORE
    // it looks at the department, so a department id is not a campus claim.
    // The explainer checked only the department and answered yes for a row the
    // operation itself refuses — and an explainer that contradicts the gate is
    // worse than none, because a person acts on the explanation.
    const harness = await connect({
      principal: DEPARTMENT_MEMBER("dept-a", "1"),
    });
    try {
      const denied = await callTool(harness.client, "biso_explain_permission", {
        domain: "news",
        operation: "publish",
        campusId: "2",
        departmentId: "dept-a",
      });
      const deniedData = denied.structured?.data as {
        allowed: boolean;
        reasons: string[];
      };
      expect(deniedData.allowed).toBe(false);
      expect(deniedData.reasons.join(" ")).toMatch(BERGEN_I_RE);

      // Their own campus still answers yes, so the check narrows rather than
      // simply refusing department members.
      const allowed = await callTool(
        harness.client,
        "biso_explain_permission",
        {
          domain: "news",
          operation: "publish",
          campusId: "1",
          departmentId: "dept-a",
        }
      );
      expect((allowed.structured?.data as { allowed: boolean }).allowed).toBe(
        true
      );
    } finally {
      await harness.close();
    }
  });

  test("the capability matrix carries a reason for every gap", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_list_capabilities"
      );
      const matrix = (
        structured?.data as {
          matrix: Array<{ operations: Record<string, string> }>;
        }
      ).matrix;
      for (const row of matrix) {
        for (const value of Object.values(row.operations)) {
          // Either supported, or a non-empty reason.
          expect(value.length).toBeGreaterThan(0);
        }
      }
    } finally {
      await harness.close();
    }
  });
});

describe("mutations", () => {
  test("propose mode returns a proposal and writes nothing", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_content_create_draft",
        {
          domain: "news",
          slug: "test-draft",
          campusId: "1",
          titleNo: "Tittel",
          titleEn: "Title",
          descriptionNo: "Tekst",
          descriptionEn: "Text",
        }
      );
      expect(structured?.ok).toBe(true);
      const proposal = (
        structured?.data as { proposal: Record<string, unknown> }
      ).proposal;
      expect(proposal.proposalToken).toBeTruthy();
      expect((proposal.execution as { executable: boolean }).executable).toBe(
        false
      );
      expect(domainWrites(harness)).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });

  test("operator mode executes a proposal and the draft is not public", async () => {
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      config: baseConfig({ writeMode: "operator" }),
    });
    try {
      const first = await callTool(
        harness.client,
        "biso_content_create_draft",
        {
          domain: "news",
          slug: "test-draft",
          campusId: "1",
          titleNo: "Tittel",
          titleEn: "Title",
          descriptionNo: "Tekst",
          descriptionEn: "Text",
        }
      );
      const proposal = (
        first.structured?.data as {
          proposal: { proposalToken: string; expiresAt: string };
        }
      ).proposal;
      expect(domainWrites(harness)).toHaveLength(0);

      const second = await callTool(
        harness.client,
        "biso_content_create_draft",
        {
          domain: "news",
          slug: "test-draft",
          campusId: "1",
          titleNo: "Tittel",
          titleEn: "Title",
          descriptionNo: "Tekst",
          descriptionEn: "Text",
          proposalToken: proposal.proposalToken,
          proposalExpiresAt: proposal.expiresAt,
        }
      );
      expect(second.structured?.ok).toBe(true);
      const write = domainWrites(harness).at(-1);
      expect(write?.table).toBe("news");
      expect(write?.data?.status).toBe("draft");
      // A draft carries no public read permission.
      expect(write?.permissions).toEqual([]);
    } finally {
      await harness.close();
    }
  });

  test("a propose-only call is not recorded as a completed action", async () => {
    // `createAuditor` persists exactly the `ok` outcomes, so classifying a
    // proposal as `ok` would put a row in `audit_logs` describing a change
    // that was never made.
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      config: baseConfig({ writeMode: "propose" }),
    });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_content_create_draft",
        {
          domain: "news",
          slug: "nothing-written",
          campusId: "1",
          titleNo: "A",
          titleEn: "A",
          descriptionNo: "A",
          descriptionEn: "A",
        }
      );

      expect(structured?.ok).toBe(true);
      expect(structured?.effect).toBe("proposed");
      expect(domainWrites(harness)).toHaveLength(0);
      // No audit row either — the auditor only persists executed changes.
      expect(
        harness.backend.writes.filter((write) => write.table === "audit_logs")
      ).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });

  test("an executed mutation is recorded as one", async () => {
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      config: baseConfig({ writeMode: "operator" }),
    });
    try {
      const args = {
        domain: "news",
        slug: "written",
        campusId: "1",
        titleNo: "A",
        titleEn: "A",
        descriptionNo: "A",
        descriptionEn: "A",
      };
      const first = await callTool(
        harness.client,
        "biso_content_create_draft",
        args
      );
      const proposal = (
        first.structured?.data as {
          proposal: { proposalToken: string; expiresAt: string };
        }
      ).proposal;

      const executed = await callTool(
        harness.client,
        "biso_content_create_draft",
        {
          ...args,
          proposalToken: proposal.proposalToken,
          proposalExpiresAt: proposal.expiresAt,
        }
      );
      expect(executed.structured?.effect).toBe("executed");
      expect(
        harness.backend.writes.filter((write) => write.table === "audit_logs")
          .length
      ).toBeGreaterThan(0);
    } finally {
      await harness.close();
    }
  });

  test("a write whose reply is lost reports an uncertain outcome", async () => {
    // The dangerous shape: Appwrite accepted the row and the connection
    // dropped before the response. `fetch` throws with no HTTP status, so
    // `fromAppwriteError` has nothing to classify and falls through to
    // `internal` — which reads as "it failed", and invites the caller to
    // propose the same draft again and create a second row.
    const dropped = Object.assign(new Error("fetch failed"), {
      cause: Object.assign(new Error("read ECONNRESET"), {
        code: "ECONNRESET",
      }),
    });
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      config: baseConfig({ writeMode: "operator" }),
      onWrite: (_op, table) => {
        if (table === "news") {
          throw dropped;
        }
      },
    });
    try {
      const args = {
        domain: "news",
        slug: "lost-reply",
        campusId: "1",
        titleNo: "Tittel",
        titleEn: "Title",
        descriptionNo: "Tekst",
        descriptionEn: "Text",
      };
      const first = await callTool(
        harness.client,
        "biso_content_create_draft",
        args
      );
      const proposal = (
        first.structured?.data as {
          proposal: { proposalToken: string; expiresAt: string };
        }
      ).proposal;

      const executed = await callTool(
        harness.client,
        "biso_content_create_draft",
        {
          ...args,
          proposalToken: proposal.proposalToken,
          proposalExpiresAt: proposal.expiresAt,
        }
      );

      expect(executed.response.isError).toBe(true);
      const error = (executed.structured as { error: { code: string } }).error;
      expect(error.code).toBe("external_uncertain");
      // And the write really was dispatched, which is why it is uncertain.
      expect(
        harness.backend.writes.some((write) => write.table === "news")
      ).toBe(true);
    } finally {
      await harness.close();
    }
  });

  test("a backend that answers with a failure is reported as a failure", async () => {
    // The other side of the line. A 500 means Appwrite replied, so the write
    // did not happen — telling the caller "do not retry" would be wrong.
    const refused = Object.assign(new Error("Server error"), { code: 500 });
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      config: baseConfig({ writeMode: "operator" }),
      onWrite: (_op, table) => {
        if (table === "news") {
          throw refused;
        }
      },
    });
    try {
      const args = {
        domain: "news",
        slug: "server-said-no",
        campusId: "1",
        titleNo: "Tittel",
        titleEn: "Title",
        descriptionNo: "Tekst",
        descriptionEn: "Text",
      };
      const first = await callTool(
        harness.client,
        "biso_content_create_draft",
        args
      );
      const proposal = (
        first.structured?.data as {
          proposal: { proposalToken: string; expiresAt: string };
        }
      ).proposal;

      const executed = await callTool(
        harness.client,
        "biso_content_create_draft",
        {
          ...args,
          proposalToken: proposal.proposalToken,
          proposalExpiresAt: proposal.expiresAt,
        }
      );

      expect(executed.response.isError).toBe(true);
      expect(
        (executed.structured as { error: { code: string } }).error.code
      ).not.toBe("external_uncertain");
    } finally {
      await harness.close();
    }
  });

  test("a proposal cannot be executed twice", async () => {
    // `createDraft` mints a fresh `ID.unique()` on every call, so a replayed
    // proposal inside its ten-minute life would create a second row that
    // nobody proposed.
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      config: baseConfig({ writeMode: "operator" }),
    });
    try {
      const args = {
        domain: "news",
        slug: "replay-me",
        campusId: "1",
        titleNo: "Tittel",
        titleEn: "Title",
        descriptionNo: "Tekst",
        descriptionEn: "Text",
      };
      const first = await callTool(
        harness.client,
        "biso_content_create_draft",
        args
      );
      const proposal = (
        first.structured?.data as {
          proposal: { proposalToken: string; expiresAt: string };
        }
      ).proposal;

      const executeArgs = {
        ...args,
        proposalToken: proposal.proposalToken,
        proposalExpiresAt: proposal.expiresAt,
      };

      const executed = await callTool(
        harness.client,
        "biso_content_create_draft",
        executeArgs
      );
      expect(executed.structured?.ok).toBe(true);
      const afterFirst = domainWrites(harness).length;
      expect(afterFirst).toBeGreaterThan(0);

      const replay = await callTool(
        harness.client,
        "biso_content_create_draft",
        executeArgs
      );
      expect(replay.response.isError).toBe(true);
      expect(JSON.stringify(replay.structured)).toContain(
        "already been executed"
      );
      // The decisive assertion: no second row.
      expect(domainWrites(harness)).toHaveLength(afterFirst);
    } finally {
      await harness.close();
    }
  });

  test("an executed result carries no reusable proposal credential", async () => {
    // The execute path rebuilds the proposal so the token binds to this call's
    // own values, and rebuilding mints a *fresh* expiry — and therefore a token
    // the single-use registry has never seen. Returning it would hand the
    // caller a second authorization for the change they just made.
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      config: baseConfig({ writeMode: "operator" }),
    });
    try {
      const args = {
        domain: "news",
        slug: "echo-me",
        campusId: "1",
        titleNo: "Tittel",
        titleEn: "Title",
        descriptionNo: "Tekst",
        descriptionEn: "Text",
      };
      const proposed = await callTool(
        harness.client,
        "biso_content_create_draft",
        args
      );
      const proposal = (
        proposed.structured?.data as {
          proposal: { proposalToken: string; expiresAt: string };
        }
      ).proposal;

      const executed = await callTool(
        harness.client,
        "biso_content_create_draft",
        {
          ...args,
          proposalToken: proposal.proposalToken,
          proposalExpiresAt: proposal.expiresAt,
        }
      );
      expect(executed.structured?.ok).toBe(true);
      const afterFirst = domainWrites(harness).length;
      expect(afterFirst).toBeGreaterThan(0);

      const applied = (
        executed.structured?.data as { proposal: Record<string, unknown> }
      ).proposal;
      expect(applied).not.toHaveProperty("proposalToken");
      // Not a fresh proposal either: the expiry names the one that was spent.
      expect(applied.expiresAt).toBe(proposal.expiresAt);

      // The decisive assertion: nothing the executed result hands back can
      // write a second row.
      await callTool(harness.client, "biso_content_create_draft", {
        ...args,
        proposalToken: (applied as { proposalToken?: string }).proposalToken,
        proposalExpiresAt: applied.expiresAt as string,
      });
      expect(domainWrites(harness)).toHaveLength(afterFirst);
    } finally {
      await harness.close();
    }
  });

  test("a token from one change cannot authorize a different one", async () => {
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      config: baseConfig({ writeMode: "operator" }),
    });
    try {
      const first = await callTool(
        harness.client,
        "biso_content_create_draft",
        {
          domain: "news",
          slug: "slug-a",
          campusId: "1",
          titleNo: "A",
          titleEn: "A",
          descriptionNo: "A",
          descriptionEn: "A",
        }
      );
      const proposal = (
        first.structured?.data as {
          proposal: { proposalToken: string; expiresAt: string };
        }
      ).proposal;

      // Same token, different slug.
      const second = await callTool(
        harness.client,
        "biso_content_create_draft",
        {
          domain: "news",
          slug: "slug-b",
          campusId: "1",
          titleNo: "A",
          titleEn: "A",
          descriptionNo: "A",
          descriptionEn: "A",
          proposalToken: proposal.proposalToken,
          proposalExpiresAt: proposal.expiresAt,
        }
      );
      expect(second.structured?.ok).toBe(false);
      expect((second.structured?.error as { code: string }).code).toBe(
        "requires_authorization"
      );
      expect(domainWrites(harness)).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });

  test("a fabricated token is refused", async () => {
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      config: baseConfig({ writeMode: "operator" }),
    });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_content_create_draft",
        {
          domain: "news",
          slug: "x",
          campusId: "1",
          titleNo: "A",
          titleEn: "A",
          descriptionNo: "A",
          descriptionEn: "A",
          proposalToken: "made-up-token",
          proposalExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        }
      );
      expect(structured?.ok).toBe(false);
      expect(domainWrites(harness)).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });

  test("a campus admin cannot create content in another campus", async () => {
    const harness = await connect({
      principal: CAMPUS_ADMIN("Oslo", "1"),
      config: baseConfig({ writeMode: "operator" }),
    });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_content_create_draft",
        {
          domain: "news",
          slug: "bergen-thing",
          campusId: "2",
          titleNo: "A",
          titleEn: "A",
          descriptionNo: "A",
          descriptionEn: "A",
        }
      );
      expect(structured?.ok).toBe(false);
      expect((structured?.error as { code: string }).code).toBe("forbidden");
      expect(domainWrites(harness)).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });

  test("confirm mode is executable when the client declares elicitation", async () => {
    // Client capabilities arrive with the `initialize` request, which the SDK
    // handles *after* `connect()` resolves. A gate that sampled them once at
    // connect time would read `undefined` and pin this to false forever,
    // silently downgrading `confirm` to `propose` for every capable client.
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      config: baseConfig({ writeMode: "confirm" }),
      clientCapabilities: { elicitation: {} },
    });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_content_create_draft",
        {
          domain: "news",
          slug: "x",
          campusId: "1",
          titleNo: "A",
          titleEn: "A",
          descriptionNo: "A",
          descriptionEn: "A",
        }
      );
      const proposal = (
        structured?.data as {
          proposal: { execution: { executable: boolean } };
        }
      ).proposal;
      expect(proposal.execution.executable).toBe(true);
    } finally {
      await harness.close();
    }
  });

  test("confirm mode writes nothing when the human declines", async () => {
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      config: baseConfig({ writeMode: "confirm" }),
      clientCapabilities: { elicitation: {} },
    });
    harness.client.setRequestHandler(ElicitRequestSchema, () =>
      Promise.resolve({ action: "decline" as const })
    );
    try {
      const args = {
        domain: "news",
        slug: "declined",
        campusId: "1",
        titleNo: "A",
        titleEn: "A",
        descriptionNo: "A",
        descriptionEn: "A",
      };
      const first = await callTool(
        harness.client,
        "biso_content_create_draft",
        args
      );
      const proposal = (
        first.structured?.data as {
          proposal: { proposalToken: string; expiresAt: string };
        }
      ).proposal;

      const declined = await callTool(
        harness.client,
        "biso_content_create_draft",
        {
          ...args,
          proposalToken: proposal.proposalToken,
          proposalExpiresAt: proposal.expiresAt,
        }
      );
      expect(declined.response.isError).toBe(true);
      expect(domainWrites(harness)).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });

  test("confirm mode without client elicitation stays proposal-only", async () => {
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      config: baseConfig({ writeMode: "confirm" }),
      clientCapabilities: {},
    });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_content_create_draft",
        {
          domain: "news",
          slug: "x",
          campusId: "1",
          titleNo: "A",
          titleEn: "A",
          descriptionNo: "A",
          descriptionEn: "A",
        }
      );
      const proposal = (
        structured?.data as {
          proposal: { execution: { executable: boolean; reason: string } };
        }
      ).proposal;
      expect(proposal.execution.executable).toBe(false);
      expect(proposal.execution.reason).toMatch(ELICITATION_I_RE);
    } finally {
      await harness.close();
    }
  });
});

describe("errors", () => {
  test("a failure is marked isError and carries a code", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const { response, structured } = await callTool(
        harness.client,
        "biso_content_get",
        { domain: "news", id: "does-not-exist" }
      );
      expect(response.isError).toBe(true);
      expect(structured?.ok).toBe(false);
      expect((structured?.error as { code: string }).code).toBe("not_found");
      expect(structured?.requestId).toBeTruthy();
    } finally {
      await harness.close();
    }
  });

  test("invalid arguments are rejected at the protocol boundary", async () => {
    // The SDK validates against the declared schema before the handler runs,
    // so an out-of-enum value never reaches domain code.
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const response = await harness.client.callTool({
        name: "biso_content_search",
        arguments: { domain: "not-a-domain" },
      });
      expect(response.isError).toBe(true);
      expect(JSON.stringify(response.content)).toMatch(DOMAIN_I_RE);
    } finally {
      await harness.close();
    }
  });

  test("an unknown tool is rejected", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const response = await harness.client.callTool({
        name: "biso_not_a_tool",
        arguments: {},
      });
      expect(response.isError).toBe(true);
    } finally {
      await harness.close();
    }
  });
});

describe("resources and prompts", () => {
  test("the support matrix resource is readable", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const resource = await harness.client.readResource({
        uri: "biso://schema/content-support-matrix",
      });
      const first = resource.contents[0];
      const text = "text" in first ? String(first.text) : "";
      const parsed = JSON.parse(text) as { matrix: unknown[] };
      expect(parsed.matrix.length).toBeGreaterThan(0);
    } finally {
      await harness.close();
    }
  });

  test("the permissions guide is not offered to an anonymous session", async () => {
    const asAnon = await connect({ principal: ANONYMOUS() });
    const asAdmin = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const anonUris = (await asAnon.client.listResources()).resources.map(
        (r) => r.uri
      );
      const adminUris = (await asAdmin.client.listResources()).resources.map(
        (r) => r.uri
      );
      expect(anonUris).not.toContain("biso://guide/permissions");
      expect(adminUris).toContain("biso://guide/permissions");
    } finally {
      await asAnon.close();
      await asAdmin.close();
    }
  });

  test("a prompt returns a usable message", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const prompt = await harness.client.getPrompt({
        name: "campus-briefing",
        arguments: { campus: "Oslo" },
      });
      expect(prompt.messages).toHaveLength(1);
      const content = prompt.messages[0].content;
      expect("text" in content ? content.text : "").toMatch(BISO_WHOAMI_RE);
    } finally {
      await harness.close();
    }
  });

  test("staff prompts are not offered anonymously", async () => {
    const harness = await connect({ principal: ANONYMOUS() });
    try {
      const names = (await harness.client.listPrompts()).prompts.map(
        (p) => p.name
      );
      expect(names).toContain("find-published");
      expect(names).not.toContain("campus-briefing");
    } finally {
      await harness.close();
    }
  });
});

describe("running without AI provider credentials", () => {
  test("the server starts and every tool works", async () => {
    // No OPENAI_API_KEY is set anywhere in these tests.
    const config = baseConfig();
    expect(config.ai.enabled).toBe(false);

    const harness = await connect({ principal: GLOBAL_ADMIN(), config });
    try {
      const { tools } = await harness.client.listTools();
      expect(tools.length).toBeGreaterThan(10);
      const { structured } = await callTool(
        harness.client,
        "biso_content_search",
        { domain: "news" }
      );
      expect(structured?.ok).toBe(true);
    } finally {
      await harness.close();
    }
  });

  test("the composite workflows are deterministic and need no provider", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_campus_briefing"
      );
      expect(structured?.ok).toBe(true);
      expect(String((structured?.data as { method: string }).method)).toMatch(
        NO_LANGUAGE_MODEL_I_RE
      );
    } finally {
      await harness.close();
    }
  });
});

describe("lookups", () => {
  test("ambiguous department references are refused with candidates", async () => {
    // "ESN" exists in two campuses; picking one silently would be wrong.
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_resolve_department",
        { reference: "ESN" }
      );
      expect(structured?.ok).toBe(false);
      expect((structured?.error as { code: string }).code).toBe(
        "invalid_input"
      );
      const details = (
        structured?.error as { details: Record<string, unknown> }
      ).details;
      expect((details.candidates as unknown[]).length).toBe(2);
    } finally {
      await harness.close();
    }
  });

  test("an exact id resolves", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_resolve_department",
        { reference: "dept-a" }
      );
      expect(structured?.ok).toBe(true);
    } finally {
      await harness.close();
    }
  });

  test("operating ledgers are excluded from the public unit listing", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_list_departments",
        { publicOnly: true }
      );
      const departments = (
        structured?.data as { departments: Array<{ id: string }> }
      ).departments;
      expect(departments.map((d) => d.id)).not.toContain("dept-ledger");
    } finally {
      await harness.close();
    }
  });

  test("feature flags report the effective state and whether it is a default", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_list_feature_flags"
      );
      const flags = (
        structured?.data as {
          flags: Array<{ key: string; enabled: boolean; isDefault: boolean }>;
        }
      ).flags;
      const stripe = flags.find((flag) => flag.key === "payments_stripe");
      expect(stripe?.enabled).toBe(false);
      expect(stripe?.isDefault).toBe(false);
      const shopLedger = flags.find(
        (flag) => flag.key === "shop_ledger_posting"
      );
      expect(shopLedger?.enabled).toBe(false);
      expect(shopLedger?.isDefault).toBe(true);
    } finally {
      await harness.close();
    }
  });
});

describe("clients wiring", () => {
  test("requireElevated throws a clear unavailable error when unconfigured", () => {
    const { logger } = collectingLogger();
    const clients = createBackendClients(
      baseConfig({
        appwrite: { ...baseConfig().appwrite, apiKey: null },
      }),
      logger
    );
    expect(clients.hasElevated).toBe(false);
    expect(() => clients.requireElevated("test")).toThrow(
      SERVICE_KEY_CLIENT_WHICH_IS_NOT_CONF_RE
    );
  });

  test("a service key alone leaves hasUserCredential false", () => {
    const { logger } = collectingLogger();
    const clients = createBackendClients(
      baseConfig({
        appwrite: {
          ...baseConfig().appwrite,
          apiKey: "secret",
          userCredential: null,
        },
      }),
      logger
    );
    expect(clients.hasElevated).toBe(true);
    expect(clients.hasUserCredential).toBe(false);
  });
});

describe("audit_logs is a record of changes, not of questions", () => {
  /**
   * The auditor's stated contract is that mutations — not every call — attempt
   * an `audit_logs` row, so an MCP change shows up in the same activity feed as
   * a portal change. It persists exactly the `ok` outcomes, which makes the
   * result-to-outcome mapping the thing that decides what staff see there.
   */
  function auditRows(harness: Harness) {
    return harness.backend.writes.filter(
      (write) => write.table === "audit_logs"
    );
  }

  test("a successful read writes no audit row", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      const { structured } = await callTool(harness.client, "biso_whoami");
      expect(structured?.ok).toBe(true);
      expect(structured?.effect).toBe("read");
      expect(auditRows(harness)).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });

  test("several reads still write none", async () => {
    const harness = await connect({ principal: GLOBAL_ADMIN() });
    try {
      await callTool(harness.client, "biso_whoami");
      await callTool(harness.client, "biso_list_campuses");
      await callTool(harness.client, "biso_content_search", { domain: "news" });
      expect(auditRows(harness)).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });

  test("a proposal writes none", async () => {
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      config: baseConfig({ writeMode: "propose" }),
    });
    try {
      await callTool(harness.client, "biso_content_create_draft", {
        domain: "news",
        slug: "unwritten",
        campusId: "1",
        titleNo: "A",
        titleEn: "A",
        descriptionNo: "A",
        descriptionEn: "A",
      });
      expect(auditRows(harness)).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });

  test("an executed mutation does write one", async () => {
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      config: baseConfig({ writeMode: "operator" }),
    });
    try {
      const args = {
        domain: "news",
        slug: "audited",
        campusId: "1",
        titleNo: "A",
        titleEn: "A",
        descriptionNo: "A",
        descriptionEn: "A",
      };
      const first = await callTool(
        harness.client,
        "biso_content_create_draft",
        args
      );
      const proposal = (
        first.structured?.data as {
          proposal: { proposalToken: string; expiresAt: string };
        }
      ).proposal;
      await callTool(harness.client, "biso_content_create_draft", {
        ...args,
        proposalToken: proposal.proposalToken,
        proposalExpiresAt: proposal.expiresAt,
      });
      expect(auditRows(harness).length).toBeGreaterThan(0);
    } finally {
      await harness.close();
    }
  });
});

describe("approval requests", () => {
  test("a non-HR department member cannot file a job approval", async () => {
    // `jobs` grants `read("any")`, so a department member can read a vacancy in
    // their own department. Without a gate here they could file a persisted
    // `jobs.publish` request, and the portal's executor checks the *approver's*
    // publish access, never the requester's role — so Operations Unit could
    // grant it and a vacancy would enter recruitment with no HR involvement.
    const harness = await connect({
      principal: DEPARTMENT_MEMBER(),
      config: baseConfig({ writeMode: "operator" }),
    });
    try {
      const { response, structured } = await callTool(
        harness.client,
        "biso_request_approval",
        { domain: "jobs", id: "job-1" }
      );
      expect(response.isError).toBe(true);
      expect(JSON.stringify(structured)).toContain("HR");
      expect(domainWrites(harness)).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });

  test("a staff member cannot file an approval for another campus's content", async () => {
    // `content.get` lets any staff principal read a *published* row, which is
    // right for reading and wrong as the only gate on filing an approval: the
    // portal's executor checks the approver's scope, never the requester's.
    const harness = await connect({
      principal: CAMPUS_ADMIN("Bergen", "2"),
      config: baseConfig({ writeMode: "operator" }),
    });
    try {
      const { response, structured } = await callTool(
        harness.client,
        "biso_request_approval",
        { domain: "news", id: "news-oslo" }
      );
      expect(response.isError).toBe(true);
      // `forbidden`, not `not_found`: they *can* read this row — it is
      // published — which is exactly why reading it is not enough to file
      // an approval against it.
      expect(JSON.stringify(structured)).toContain("forbidden");
      expect(domainWrites(harness)).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });

  test("someone who could publish it may still route it through review", async () => {
    // There is no principal who can edit a row but not publish it:
    // `assertPublishAccess` delegates to `assertWriteAccess`, here and in
    // `apps/admin`. So a refusal keyed on "you could do this yourself" refuses
    // everyone, and this tool — which mirrors a real portal capability, gated
    // there by `requireAuth` alone — becomes unreachable.
    //
    // The previous version of this test asserted that refusal. It was written
    // to lock in a fix that was itself incomplete, and it would have kept
    // passing over a dead tool forever.
    const harness = await connect({
      principal: DEPARTMENT_MEMBER("dept-a", "1"),
      config: baseConfig({ writeMode: "operator" }),
    });
    try {
      const args = { domain: "news", id: "news-oslo" };
      const { response, structured } = await callTool(
        harness.client,
        "biso_request_approval",
        args
      );

      expect(response.isError).toBeFalsy();
      expect(structured?.effect).toBe("proposed");
      // Informational, not a refusal: it says which situation they are in.
      expect(((structured?.warnings ?? []) as string[]).join(" ")).toContain(
        "publish this yourself"
      );

      // And the proposal really executes — the point of the finding is that
      // the tool had become unreachable, so a reachable proposal is only half
      // the property.
      const proposal = (
        structured?.data as {
          proposal: { proposalToken: string; expiresAt: string };
        }
      ).proposal;
      const executed = await callTool(harness.client, "biso_request_approval", {
        ...args,
        proposalToken: proposal.proposalToken,
        proposalExpiresAt: proposal.expiresAt,
      });

      expect(executed.structured?.effect).toBe("executed");
      expect(
        domainWrites(harness).some(
          (write) => write.table === "approval_requests"
        )
      ).toBe(true);
    } finally {
      await harness.close();
    }
  });

  test("the request is still refused for content outside the requester's scope", async () => {
    // Removing the redundancy guard must not soften the gate that matters.
    const harness = await connect({
      principal: DEPARTMENT_MEMBER("dept-a", "1"),
      config: baseConfig({ writeMode: "operator" }),
    });
    try {
      const { response } = await callTool(
        harness.client,
        "biso_request_approval",
        { domain: "news", id: "news-bergen" }
      );

      expect(response.isError).toBe(true);
      expect(domainWrites(harness)).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });

  test("the refusal happens before the vacancy is read", async () => {
    const harness = await connect({
      principal: DEPARTMENT_MEMBER(),
      config: baseConfig({ writeMode: "operator" }),
    });
    try {
      await callTool(harness.client, "biso_request_approval", {
        domain: "jobs",
        id: "job-1",
      });
      // Nothing elevated, nothing written: the gate is the first thing to run.
      expect(harness.backend.elevations).toEqual([]);
    } finally {
      await harness.close();
    }
  });
});

describe("draft structure is not reachable through a second door", () => {
  /**
   * `biso_page_load` limits an out-of-scope caller to the published document.
   * `biso_page_edit_blocks` reloads the document independently — and that
   * reload prefers the draft. Even in propose mode, building the proposal
   * would report the draft's block ids, types and count through `outcomes`
   * and `resultingBlocks`, before `saveDraft` ever got the chance to refuse.
   */
  function publishedWithSecretDraft(): FakeTables {
    return {
      pages: [
        {
          $id: "page-pub",
          $createdAt: "2026-01-01T00:00:00.000Z",
          $updatedAt: "2026-01-01T00:00:00.000Z",
          slug: "public-page",
          status: "published",
          visibility: "public",
          campus_id: "1",
          department_id: "dept-a",
          campus: { $id: "1" },
          department: { $id: "dept-a" },
          translation_refs: [
            {
              $id: "tr-pub",
              $updatedAt: "2026-01-01T00:00:00.000Z",
              locale: "no",
              title: "Public page",
              description: "Released",
              is_published: true,
              published_at: "2026-01-01T00:00:00.000Z",
              draft_document: JSON.stringify({
                blocks: [
                  { id: "SECRET-BLOCK", type: "text", body: "unreleased" },
                ],
                meta: { title: "t", slug: "s", status: "published" },
              }),
              puck_document: JSON.stringify({
                blocks: [{ id: "live-block", type: "text", body: "released" }],
                meta: { title: "t", slug: "s", status: "published" },
              }),
            },
          ],
        },
      ],
      page_translations: [],
    };
  }

  test("an out-of-scope caller cannot propose edits, and learns nothing of the draft", async () => {
    const harness = await connect({
      principal: CAMPUS_ADMIN("Bergen", "2"),
      config: baseConfig({ writeMode: "propose" }),
      tables: publishedWithSecretDraft(),
    });
    try {
      const { response, structured } = await callTool(
        harness.client,
        "biso_page_edit_blocks",
        {
          pageId: "page-pub",
          locale: "no",
          edits: [{ op: "insert", blockType: "text" }],
        }
      );
      expect(response.isError).toBe(true);
      expect(JSON.stringify(structured)).not.toContain("SECRET-BLOCK");
      expect(domainWrites(harness)).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });

  test("the owning department can still propose edits", async () => {
    const harness = await connect({
      principal: DEPARTMENT_MEMBER("dept-a", "1"),
      config: baseConfig({ writeMode: "propose" }),
      tables: publishedWithSecretDraft(),
    });
    try {
      const { response } = await callTool(
        harness.client,
        "biso_page_edit_blocks",
        {
          pageId: "page-pub",
          locale: "no",
          edits: [{ op: "insert", blockType: "text" }],
        }
      );
      expect(response.isError).toBeFalsy();
    } finally {
      await harness.close();
    }
  });
});

describe("the briefing and the audit report what they measured", () => {
  /**
   * Relative to the real clock, not the calendar. The briefing measures its
   * horizon from `new Date()`, so a hardcoded date stops being "soon" the day
   * it passes and the test then fails for a reason that has nothing to do with
   * what it checks — which is exactly what happened to the literal that used
   * to sit here.
   */
  const DAY = 86_400_000;
  const SOON = new Date(Date.now() + 2 * DAY).toISOString();
  const FAR = new Date(Date.now() + 300 * DAY).toISOString();

  /**
   * `BRIEFING_LIMIT` published events, all edited today and all starting far
   * beyond the horizon, plus one imminent event nobody has touched in months.
   * Ordered by `$updatedAt` the imminent one falls outside the window, and the
   * briefing reports that nothing is coming up.
   */
  function eventsWithOneImminent(): FakeTables {
    const events: FakeRow[] = [];
    for (let index = 0; index < 25; index += 1) {
      events.push({
        $id: `far-${index}`,
        $createdAt: "2026-09-15T00:00:00.000Z",
        $updatedAt: "2026-09-15T00:00:00.000Z",
        slug: `far-${index}`,
        status: "published",
        campus_id: "1",
        start_date: FAR,
        pricing_mode: "free",
      });
    }
    events.push({
      $id: "imminent",
      $createdAt: "2026-01-01T00:00:00.000Z",
      $updatedAt: "2026-01-01T00:00:00.000Z",
      slug: "imminent",
      status: "published",
      campus_id: "1",
      start_date: SOON,
      pricing_mode: "free",
    });
    return { events, campus: [{ $id: "1", name: "Oslo" }] };
  }

  test("an imminent event is not displaced by recently edited ones", async () => {
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      tables: eventsWithOneImminent(),
    });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_campus_briefing",
        { horizonDays: 30 }
      );
      const findings = (
        structured?.data as {
          findings: Array<{ items: Array<{ id: string }>; kind: string }>;
        }
      ).findings;
      const upcoming = findings.find(
        (finding) => finding.kind === "events_starting_soon"
      );
      expect(upcoming?.items.map((item) => item.id)).toContain("imminent");
    } finally {
      await harness.close();
    }
  });

  test("a paid event with a member price is not flagged as missing one", async () => {
    // `member_price` has to be in the projection for the check to mean
    // anything: an unselected column reads as `undefined`, which is
    // indistinguishable from "not set".
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      tables: {
        campus: [{ $id: "1", name: "Oslo" }],
        events: [
          {
            $id: "paid-event",
            $createdAt: "2026-09-15T00:00:00.000Z",
            $updatedAt: "2026-09-15T00:00:00.000Z",
            slug: "paid",
            status: "published",
            campus_id: "1",
            start_date: FAR,
            pricing_mode: "paid",
            member_only: false,
            member_price: 150,
          },
        ],
      },
    });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_content_quality_audit",
        { domain: "events" }
      );
      const issues = (
        structured?.data as { issues: Array<{ problems: string[] }> }
      ).issues;
      const problems = issues.flatMap((issue) => issue.problems);
      expect(problems.join(" ")).not.toMatch(MEMBER_PRICE_I_RE);
    } finally {
      await harness.close();
    }
  });

  test("the briefing's inbox counts honour the campus it reports", async () => {
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      tables: {
        campus: [
          { $id: "1", name: "Oslo" },
          { $id: "2", name: "Bergen" },
        ],
        approval_requests: [
          { $id: "a-oslo", status: "pending", campus_id: "1" },
          { $id: "a-bergen", status: "pending", campus_id: "2" },
        ],
        form_submissions: [{ $id: "s-bergen", status: "new", campus_id: "2" }],
      },
    });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_campus_briefing",
        { campusId: "1" }
      );
      const data = structured?.data as {
        campusFilter: string;
        findings: Array<{ kind: string; message: string }>;
      };
      expect(data.campusFilter).toMatch(OSLO_RE);
      const approvals = data.findings.find(
        (finding) => finding.kind === "pending_approvals"
      );
      expect(approvals?.message).toContain("1 approval");
      // Bergen's submission belongs to another campus's briefing.
      expect(
        data.findings.some((finding) => finding.kind === "new_submissions")
      ).toBe(false);
    } finally {
      await harness.close();
    }
  });
});

describe("a confirmation dialog does not extend a proposal's life", () => {
  test("accepting after the expiry writes nothing", async () => {
    // The elicitation has no deadline of its own, and the token is verified
    // before it opens. The clock is advanced from inside the handler, which is
    // exactly the shape of the real case: a dialog left open past the TTL and
    // then accepted.
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      config: baseConfig({ writeMode: "confirm" }),
      clientCapabilities: { elicitation: {} },
    });
    try {
      const args = {
        domain: "news",
        slug: "slow-confirm",
        campusId: "1",
        titleNo: "Tittel",
        titleEn: "Title",
        descriptionNo: "Tekst",
        descriptionEn: "Text",
      };
      const proposed = await callTool(
        harness.client,
        "biso_content_create_draft",
        args
      );
      const proposal = (
        proposed.structured?.data as {
          proposal: { proposalToken: string; expiresAt: string };
        }
      ).proposal;

      harness.client.setRequestHandler(ElicitRequestSchema, () => {
        setSystemTime(new Date(Date.parse(proposal.expiresAt) + 60_000));
        return Promise.resolve({
          action: "accept" as const,
          content: { confirm: true },
        });
      });

      const executed = await callTool(
        harness.client,
        "biso_content_create_draft",
        {
          ...args,
          proposalToken: proposal.proposalToken,
          proposalExpiresAt: proposal.expiresAt,
        }
      );

      expect(executed.response.isError).toBe(true);
      expect(JSON.stringify(executed.structured)).toMatch(EXPIRED_I_RE);
      expect(domainWrites(harness)).toHaveLength(0);
    } finally {
      setSystemTime();
      await harness.close();
    }
  });
});

describe("an owner whose page has no draft can still edit it", () => {
  /**
   * A legacy translation row: only `puck_document`. `documentSource` reads
   * "published" for the owner too, so a guard that treats that as "out of
   * scope" locks the owner out of creating the draft — while `saveDraft`
   * enforces ownership independently anyway.
   */
  function publishedOnlyPage(): FakeTables {
    return {
      campus: [{ $id: "1", name: "Oslo" }],
      departments: [
        {
          $id: "dept-a",
          Name: "ESN Oslo",
          campus_id: "1",
          slug: "esn",
          type: "unit",
          active: true,
        },
      ],
      pages: [
        {
          $id: "page-legacy",
          $createdAt: "2026-01-01T00:00:00.000Z",
          $updatedAt: "2026-01-01T00:00:00.000Z",
          slug: "legacy",
          status: "published",
          visibility: "public",
          campus_id: "1",
          department_id: "dept-a",
          campus: { $id: "1" },
          department: { $id: "dept-a" },
          translation_refs: [
            {
              $id: "tr-legacy",
              $updatedAt: "2026-01-01T00:00:00.000Z",
              locale: "no",
              title: "Legacy page",
              description: "Released",
              is_published: true,
              published_at: "2026-01-01T00:00:00.000Z",
              draft_document: null,
              puck_document: JSON.stringify({
                blocks: [{ id: "live", type: "text", body: "Released" }],
                meta: {
                  title: "Legacy page",
                  slug: "legacy",
                  status: "published",
                },
              }),
            },
          ],
        },
      ],
      audit_logs: [],
    };
  }

  test("the owner is allowed to propose the first draft", async () => {
    const harness = await connect({
      principal: DEPARTMENT_MEMBER("dept-a", "1"),
      config: baseConfig({ writeMode: "propose" }),
      tables: publishedOnlyPage(),
    });
    try {
      const { response } = await callTool(
        harness.client,
        "biso_page_edit_blocks",
        {
          pageId: "page-legacy",
          locale: "no",
          edits: [{ op: "insert", blockType: "text" }],
        }
      );
      expect(response.isError).toBeFalsy();
    } finally {
      await harness.close();
    }
  });

  test("another campus is still refused", async () => {
    const harness = await connect({
      principal: CAMPUS_ADMIN("Bergen", "2"),
      config: baseConfig({ writeMode: "propose" }),
      tables: publishedOnlyPage(),
    });
    try {
      const { response, structured } = await callTool(
        harness.client,
        "biso_page_edit_blocks",
        {
          pageId: "page-legacy",
          locale: "no",
          edits: [{ op: "insert", blockType: "text" }],
        }
      );
      expect(response.isError).toBe(true);
      expect(JSON.stringify(structured)).toContain("outside your scope");
    } finally {
      await harness.close();
    }
  });
});

describe("an owner can repair a malformed draft", () => {
  /**
   * `load` treats an unparseable `draft_document` as absent and serves the
   * published one, and an owner is authorized to edit that. The edit path
   * reloads the document independently, so it has to make the same choice —
   * picking the draft on non-nullness alone throws on exactly the row the
   * owner came to repair.
   */
  function pageWithBrokenDraft(): FakeTables {
    return {
      campus: [{ $id: "1", name: "Oslo" }],
      departments: [
        {
          $id: "dept-a",
          Name: "ESN Oslo",
          campus_id: "1",
          slug: "esn",
          type: "unit",
          active: true,
        },
      ],
      pages: [
        {
          $id: "page-broken",
          $createdAt: "2026-01-01T00:00:00.000Z",
          $updatedAt: "2026-01-01T00:00:00.000Z",
          slug: "broken",
          status: "published",
          visibility: "public",
          campus_id: "1",
          department_id: "dept-a",
          campus: { $id: "1" },
          department: { $id: "dept-a" },
          translation_refs: [
            {
              $id: "tr-broken",
              $updatedAt: "2026-01-01T00:00:00.000Z",
              locale: "no",
              title: "Broken page",
              description: "Released",
              is_published: true,
              published_at: "2026-01-01T00:00:00.000Z",
              draft_document: "{ this is not json",
              puck_document: JSON.stringify({
                blocks: [{ id: "live", type: "text", body: "Released" }],
                meta: {
                  title: "Broken page",
                  slug: "broken",
                  status: "published",
                },
              }),
            },
          ],
        },
      ],
      audit_logs: [],
    };
  }

  test("the edit falls back to the published document", async () => {
    const harness = await connect({
      principal: DEPARTMENT_MEMBER("dept-a", "1"),
      config: baseConfig({ writeMode: "propose" }),
      tables: pageWithBrokenDraft(),
    });
    try {
      const { response, structured } = await callTool(
        harness.client,
        "biso_page_edit_blocks",
        {
          pageId: "page-broken",
          locale: "no",
          edits: [{ op: "insert", blockType: "text" }],
        }
      );
      expect(response.isError).toBeFalsy();
      // Built on the published blocks, so the existing one is still there.
      expect(JSON.stringify(structured)).toContain("live");
    } finally {
      await harness.close();
    }
  });
});

describe("scope is checked before a proposal exists", () => {
  function publishedPageElsewhere(): FakeTables {
    return {
      campus: [
        { $id: "1", name: "Oslo" },
        { $id: "2", name: "Bergen" },
      ],
      departments: [
        {
          $id: "dept-a",
          Name: "ESN Oslo",
          campus_id: "1",
          slug: "esn",
          type: "unit",
          active: true,
        },
      ],
      pages: [
        {
          $id: "page-oslo",
          $createdAt: "2026-01-01T00:00:00.000Z",
          $updatedAt: "2026-01-01T00:00:00.000Z",
          slug: "oslo-page",
          status: "published",
          visibility: "public",
          campus_id: "1",
          department_id: "dept-a",
          campus: { $id: "1" },
          department: { $id: "dept-a" },
          translation_refs: [
            {
              $id: "tr-oslo",
              $updatedAt: "2026-01-01T00:00:00.000Z",
              locale: "no",
              title: "Oslo page",
              description: "Released",
              is_published: true,
              published_at: "2026-01-01T00:00:00.000Z",
              draft_document: null,
              puck_document: JSON.stringify({
                blocks: [{ id: "live", type: "text" }],
                meta: { title: "Oslo page", slug: "oslo-page" },
              }),
            },
          ],
        },
      ],
      audit_logs: [],
    };
  }

  test("another campus cannot get a publish proposal", async () => {
    // `load` hands them the published view on purpose, so reaching the handler
    // proves nothing. A proposal would be reported executable, and in confirm
    // mode would put a confirmation in front of a person, for a change
    // `setPublished` refuses once the token comes back.
    const harness = await connect({
      principal: CAMPUS_ADMIN("Bergen", "2"),
      config: baseConfig({ writeMode: "operator" }),
      tables: publishedPageElsewhere(),
    });
    try {
      const { response, structured } = await callTool(
        harness.client,
        "biso_page_publish",
        { pageId: "page-oslo", locale: "no", publish: false }
      );

      expect(response.isError).toBe(true);
      expect(JSON.stringify(structured)).not.toContain("proposalToken");
      expect(domainWrites(harness)).toHaveLength(0);
    } finally {
      await harness.close();
    }
  });

  test("the owning campus still gets one", async () => {
    const harness = await connect({
      principal: CAMPUS_ADMIN("Oslo", "1"),
      config: baseConfig({ writeMode: "propose" }),
      tables: publishedPageElsewhere(),
    });
    try {
      const { response } = await callTool(harness.client, "biso_page_publish", {
        pageId: "page-oslo",
        locale: "no",
        publish: false,
      });
      expect(response.isError).toBeFalsy();
    } finally {
      await harness.close();
    }
  });
});

/**
 * What a briefing says when it could not read everything.
 *
 * Every collector answers a failure the same way: push a warning, return no
 * findings. So "no findings" is ambiguous by construction — it means either
 * "nothing needs attention" or "nothing could be read" — and only the warnings
 * tell them apart. A summary that ignores them turns an outage into an
 * all-clear, which is the one reading a person must not take away.
 */
describe("an incomplete briefing does not read as an all-clear", () => {
  test("a failed probe stops the summary claiming nothing needs attention", async () => {
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      tables: { campus: [{ $id: "1", name: "Oslo" }] },
      onRead: () => {
        throw new Error("backend unavailable");
      },
    });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_campus_briefing",
        { horizonDays: 30 }
      );

      const data = structured?.data as { findings: unknown[] };
      expect(data.findings).toHaveLength(0);
      expect(structured?.warnings ?? []).not.toHaveLength(0);
      expect(structured?.summary).not.toContain("Nothing needs attention");
      expect(structured?.summary).toContain("incomplete");
    } finally {
      await harness.close();
    }
  });

  test("a genuinely quiet briefing still says so", async () => {
    // The negative control: the caveat must come from the warnings, not from
    // the summary having simply stopped making a claim.
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      tables: {
        campus: [{ $id: "1", name: "Oslo" }],
        events: [],
        news: [],
        jobs: [],
        approval_requests: [],
        form_submissions: [],
      },
    });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_campus_briefing",
        { horizonDays: 30 }
      );

      expect(structured?.warnings ?? []).toHaveLength(0);
      expect(structured?.summary).toContain("Nothing needs attention");
    } finally {
      await harness.close();
    }
  });

  test("a half-failed inbox count is reported, not swallowed", async () => {
    // `inboxCounts` does not throw when one of its two queries fails: it
    // resolves with that count as 0 and a `note`. The collector's catch
    // therefore never runs, and a campus with pending approvals it could not
    // read looked exactly like a campus with none.
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      tables: {
        campus: [{ $id: "1", name: "Oslo" }],
        events: [],
        news: [],
        jobs: [],
        approval_requests: [],
        form_submissions: [],
      },
      onRead: (table) => {
        if (table === "approval_requests") {
          throw new Error("approvals unavailable");
        }
      },
    });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_campus_briefing",
        { horizonDays: 30 }
      );

      const inboxWarnings = (structured?.warnings ?? []) as string[];
      expect(inboxWarnings.join(" ")).toContain("Inbox counts");
      expect(structured?.summary).not.toContain("Nothing needs attention");
    } finally {
      await harness.close();
    }
  });
});

/**
 * Warnings the audit inherits from the search underneath it.
 */
describe("a full audit page keeps the search's own warnings", () => {
  function manyNews(): FakeTables {
    const news: FakeRow[] = [];
    for (let index = 0; index < 60; index += 1) {
      news.push({
        $id: `n-${index}`,
        $createdAt: "2026-01-01T00:00:00.000Z",
        $updatedAt: "2026-01-01T00:00:00.000Z",
        slug: `news-${index}`,
        status: "published",
        campus_id: "1",
        translation_refs: [{ locale: "no", title: `Nyhet ${index}` }],
      });
    }
    return { news, campus: [{ $id: "1", name: "Oslo" }] };
  }

  test("a dropped status filter survives the truncation notice", async () => {
    // `content.search` ignores an invalid status and says so. On a full page
    // the audit replaced that warning with its own, so the caller was told the
    // result was truncated but not that it had audited every status rather
    // than the one they asked for — the more misleading half.
    const harness = await connect({
      principal: GLOBAL_ADMIN(),
      tables: manyNews(),
    });
    try {
      const { structured } = await callTool(
        harness.client,
        "biso_content_quality_audit",
        { domain: "news", status: "publised" }
      );

      const warnings = (structured?.warnings ?? []) as string[];
      expect(warnings.join(" ")).toContain("not valid for news");
      expect(warnings.join(" ")).toContain("Only the first 50");
    } finally {
      await harness.close();
    }
  });
});
