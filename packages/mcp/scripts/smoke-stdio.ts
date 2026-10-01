/**
 * Standalone stdio smoke test.
 *
 * Spawns `src/bin/stdio.ts` as a real child process and drives it with a real
 * MCP client over stdio. This is the check that a unit test cannot make: it
 * proves the binary starts in a plain Bun process with no Next.js runtime and
 * no request context, that stdout carries only protocol frames, and that
 * discovery works end to end.
 *
 * It runs with NO credentials, so the server comes up on the public profile and
 * reaches no backend. Run it with `bun run packages/mcp/scripts/smoke-stdio.ts`.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const entry = new URL("../src/bin/stdio.ts", import.meta.url).pathname;

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [entry],
  env: {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    BISO_MCP_LOG_LEVEL: "error",
    // Deliberately no credentials: the public profile must work on its own.
  },
  stderr: "pipe",
});

const client = new Client(
  { name: "smoke", version: "1.0.0" },
  { capabilities: {} }
);

let failed = false;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) {
    failed = true;
  }
  process.stdout.write(
    `${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}\n`
  );
}

try {
  await client.connect(transport);
  check("connects over stdio and initializes", true);

  const serverInfo = client.getServerVersion();
  check(
    "server identifies itself",
    serverInfo?.name === "biso",
    serverInfo?.name
  );

  const { tools } = await client.listTools();
  check("advertises tools", tools.length > 0, `${tools.length} tools`);

  const names = tools.map((tool) => tool.name);
  check(
    "public discovery is available with no credentials",
    names.includes("biso_public_search")
  );
  check(
    "staff tools are NOT available with no credentials",
    !names.includes("biso_content_search")
  );
  check(
    "no mutating tool is exposed anonymously",
    tools.every((tool) => tool.annotations?.readOnlyHint === true)
  );

  const { resources } = await client.listResources();
  check("advertises resources", resources.length > 0, `${resources.length}`);

  const { prompts } = await client.listPrompts();
  check("advertises prompts", prompts.length > 0, `${prompts.length}`);

  const whoami = await client.callTool({ name: "biso_whoami", arguments: {} });
  const structured = whoami.structuredContent as
    | { ok?: boolean; data?: { principal?: { authenticated?: boolean } } }
    | undefined;
  check("biso_whoami responds", structured?.ok === true);
  check(
    "reports itself as unauthenticated rather than guessing",
    structured?.data?.principal?.authenticated === false
  );

  const matrix = await client.readResource({
    uri: "biso://schema/content-support-matrix",
  });
  const first = matrix.contents[0];
  check(
    "the support matrix resource reads",
    "text" in first && String(first.text).includes("matrix")
  );
} catch (error) {
  check(
    "smoke run",
    false,
    error instanceof Error ? error.message : String(error)
  );
} finally {
  await client.close().catch(() => undefined);
}

process.stdout.write(failed ? "\nSMOKE FAILED\n" : "\nSMOKE OK\n");
process.exit(failed ? 1 : 0);
