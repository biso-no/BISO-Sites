#!/usr/bin/env bun
/**
 * Standalone stdio entry point.
 *
 * The one hard rule of an MCP stdio server: **stdout carries framed JSON-RPC
 * and nothing else.** A single stray `console.log` anywhere in the import graph
 * — in this package, in a workspace dependency, in a transitive library —
 * corrupts the stream, and the client disconnects with a JSON parse error that
 * gives no hint where the bad byte came from.
 *
 * Guarding that by convention alone does not hold: `@repo/api`'s own server
 * module logs slow requests with `console.warn`, and a future dependency can
 * add one at any time. So this file redirects the whole `console` surface to
 * stderr before importing anything that might use it, which makes the
 * invariant structural rather than a thing to remember.
 */

const originalConsole = { ...console };

function toStderr(...args: unknown[]): void {
  try {
    const text = args
      .map((arg) =>
        typeof arg === "string" ? arg : JSON.stringify(arg, null, 0)
      )
      .join(" ");
    process.stderr.write(`${text}\n`);
  } catch {
    process.stderr.write("[unserialisable console output]\n");
  }
}

// Every console method, not just `log`: `console.info`, `console.warn` and
// `console.debug` all write to stdout in Node by default.
console.log = toStderr;
console.info = toStderr;
console.debug = toStderr;
console.warn = toStderr;
console.error = toStderr;
console.trace = toStderr;
console.dir = toStderr;

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createBisoMcpServer } from "../server";

async function main(): Promise<void> {
  const created = await createBisoMcpServer();

  const transport = new StdioServerTransport();
  await created.server.connect(transport);

  // Startup summary to stderr, where a human debugging the connection will
  // look and where it cannot corrupt the protocol stream.
  process.stderr.write(
    `${JSON.stringify({
      msg: "biso-mcp ready",
      profile: created.principal.profile,
      authenticated: created.principal.userId !== "",
      writeMode: created.config.writeMode,
      tools: created.registration.registered.length,
      unavailableTools: created.registration.unavailable.length,
      resources: created.resources.length,
      prompts: created.prompts.length,
      protocol: created.protocol.latest,
    })}\n`
  );

  const shutdown = async (signal: string) => {
    process.stderr.write(
      `{"msg":"biso-mcp shutting down","signal":"${signal}"}\n`
    );
    try {
      await created.server.close();
    } catch {
      // Closing a transport that is already gone is not worth reporting.
    }
    process.exit(0);
  };

  // `shutdown` never rejects (it swallows a close on a dead transport), but a
  // handler must not return a floating promise either, so the rejection path is
  // still terminated explicitly.
  process.on("SIGINT", () => {
    shutdown("SIGINT").catch(() => process.exit(1));
  });
  process.on("SIGTERM", () => {
    shutdown("SIGTERM").catch(() => process.exit(1));
  });
}

main().catch((error: unknown) => {
  // Startup failure is the one case where the process cannot continue. Report
  // it on stderr in a shape a human can read, and exit non-zero so a
  // supervising client shows the failure rather than hanging on a dead pipe.
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  originalConsole.error?.call(originalConsole, "");
  process.stderr.write(
    `${JSON.stringify({
      msg: "biso-mcp failed to start",
      error: message,
      hint: "Check BISO_MCP_APPWRITE_ENDPOINT, BISO_MCP_APPWRITE_PROJECT and the configured credential. A rejected credential surfaces here rather than degrading to anonymous, so a permission problem is never reported as an empty database.",
    })}\n`
  );
  if (stack && process.env.BISO_MCP_LOG_LEVEL === "debug") {
    process.stderr.write(`${stack}\n`);
  }
  process.exit(1);
});
