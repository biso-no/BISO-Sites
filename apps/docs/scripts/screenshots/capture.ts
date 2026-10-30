/**
 * Takes the guide's screenshots from a locally running admin that uses the
 * docs-only Appwrite project. For each role it signs in as the seeded user by
 * minting a session with the server SDK, so no Microsoft sign-in happens.
 *
 * Writes only `<outDir>/<id>.png` files, and to the docs project only the
 * locale preference and short-lived sessions (deleted at the end).
 *
 * Usage (from apps/docs): bun run screenshots:capture
 * See README.md in this folder.
 */
import { mkdirSync } from "node:fs";
import { relative } from "node:path";
import { type BrowserContext, chromium, type Page } from "playwright";
import {
  REPO_ROOT,
  readScreenshotConfig,
  resolveOutDir,
  type ScreenshotConfig,
  screenshotFile,
} from "./config";
import { connectToDocsProject, type DocsAdminClient } from "./docs-project";
import { type PrepareName, SHOTS, type Shot } from "./manifest";
import { buildSeedData, SHOWCASE, type StaffRole } from "./seed-data";
import { adminSessionCookie } from "./session-cookie";

/** The first visit to a route in `next dev` compiles it, which can be slow. */
const NAVIGATION_TIMEOUT_MS = 120_000;
const ACTION_TIMEOUT_MS = 30_000;
const TOUR_CHECK_TIMEOUT_MS = 1500;
const ADMIN_LOCALE = "no";
/** Hides the Next.js dev indicator and overlay, which are not part of the admin. */
const HIDE_DEV_TOOLS = "nextjs-portal { display: none !important; }";

/**
 * The named actions from the manifest. None of them saves anything or calls
 * an outside service: no "Check availability", no "Generate booking link",
 * no "Send invite", no "Submit scorecard".
 */
const PREPARES: Record<PrepareName, (page: Page) => Promise<void>> = {
  "open-schedule": async (page) => {
    await page
      .locator(".cand-card")
      .filter({ hasText: SHOWCASE.scheduleCandidateName })
      .getByTitle("Schedule interview")
      .click();
    await page.getByText("Schedule an interview").first().waitFor();
  },
  "open-scorecard": async (page) => {
    await page
      .locator(".iv-task")
      .filter({ hasText: SHOWCASE.scorecardCandidateName })
      .getByRole("button", { name: "Write" })
      .click();
    await page.getByText("Scorecard — Round 1").first().waitFor();
  },
  "show-booking-link": async (page) => {
    await page
      .locator('[data-tour="interviews-schedule"]')
      .scrollIntoViewIfNeeded();
  },
};

interface ShotGroup {
  role: StaffRole | null;
  shots: Shot[];
}

interface ShotResult {
  error?: string;
  file?: string;
  id: string;
}

function write(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** One browser context per role, plus one with no session. */
function groupShots(shots: Shot[]): ShotGroup[] {
  const groups = new Map<string, ShotGroup>();
  for (const shot of shots) {
    const key = shot.signedOut ? "signed-out" : shot.role;
    const group = groups.get(key) ?? {
      role: shot.signedOut ? null : shot.role,
      shots: [],
    };
    group.shots.push(shot);
    groups.set(key, group);
  }
  return [...groups.values()];
}

interface MintedSession {
  sessionId: string;
  userId: string;
}

/**
 * Signs the context in as `userId`: sets the locale preference the admin
 * reads, mints a session with the server SDK and puts its secret in the
 * admin's session cookie for the admin's own host. The session is handed to
 * `remember` as soon as it exists, before anything else can throw, so it is
 * always deleted at the end.
 */
async function signIn(
  client: DocsAdminClient,
  context: BrowserContext,
  config: ScreenshotConfig,
  userId: string,
  remember: (session: MintedSession) => void
): Promise<void> {
  const prefs = await client.users.getPrefs({ userId });
  await client.users.updatePrefs({
    prefs: { ...prefs, locale: ADMIN_LOCALE },
    userId,
  });
  const session = await client.users.createSession({ userId });
  remember({ sessionId: session.$id, userId });
  await context.addCookies([
    adminSessionCookie(config.adminUrl, session.secret),
  ]);
}

/** Skips the recruitment tour if it opens anyway (the seed marks it dismissed). */
async function skipTourIfShown(page: Page): Promise<void> {
  const skip = page.getByRole("button", { exact: true, name: "Hopp over" });
  const shown = await skip
    .waitFor({ state: "visible", timeout: TOUR_CHECK_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false);
  if (shown) {
    await skip.click();
  }
}

async function takeShot(
  context: BrowserContext,
  config: ScreenshotConfig,
  outDir: string,
  shot: Shot
): Promise<ShotResult> {
  const file = screenshotFile(outDir, shot.id);
  const page = await context.newPage();
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);
  try {
    await page.setViewportSize({ height: shot.height, width: shot.width });
    await page.goto(new URL(shot.route, config.adminUrl).toString(), {
      timeout: NAVIGATION_TIMEOUT_MS,
      waitUntil: "networkidle",
    });
    const landedOnSignIn = new URL(page.url()).pathname.startsWith(
      "/auth/login"
    );
    if (landedOnSignIn && !shot.signedOut) {
      throw new Error(
        "The admin sent the browser to sign-in. Is the admin running against the docs project, and was seed.ts run?"
      );
    }
    await page.addStyleTag({ content: HIDE_DEV_TOOLS });
    if (!shot.signedOut) {
      await skipTourIfShown(page);
    }
    if (shot.prepare) {
      await PREPARES[shot.prepare](page);
      await page.waitForLoadState("networkidle");
    }
    await page.screenshot({ animations: "disabled", path: file });
    return { file, id: shot.id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      id: shot.id,
    };
  } finally {
    await page.close();
  }
}

async function main(): Promise<void> {
  // The guard reads the shell's env before anything changes it.
  const config = readScreenshotConfig({ ...process.env });
  const client = await connectToDocsProject(config);
  const seed = buildSeedData();
  const outDir = resolveOutDir(config);
  mkdirSync(outDir, { recursive: true });

  const sessions: MintedSession[] = [];
  const results: ShotResult[] = [];
  const browser = await chromium.launch();
  try {
    for (const group of groupShots(SHOTS)) {
      const context = await browser.newContext({
        colorScheme: "light",
        locale: "nb-NO",
        timezoneId: "Europe/Oslo",
      });
      try {
        if (group.role) {
          await signIn(
            client,
            context,
            config,
            seed.sessionUsers[group.role],
            (session) => sessions.push(session)
          );
        }
        for (const shot of group.shots) {
          results.push(await takeShot(context, config, outDir, shot));
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    for (const { sessionId, userId } of sessions) {
      await client.users
        .deleteSession({ sessionId, userId })
        .catch(() => undefined);
    }
  }

  const failed = results.filter((result) => result.error);
  write(`Saved ${results.length - failed.length} of ${SHOTS.length} shots:`);
  for (const result of results) {
    if (result.file) {
      write(`  saved   ${result.id}  ${relative(REPO_ROOT, result.file)}`);
    } else {
      write(`  failed  ${result.id}  ${result.error}`);
    }
  }
  write(
    "Next: add a <Screenshot> tag after each shot's step (see manifest.ts) and commit the images."
  );
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

// Only when run as a script: importing this file never starts a capture.
if (import.meta.main) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Capture failed: ${message}\n`);
    process.exitCode = 1;
  });
}
