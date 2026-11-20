/**
 * Sentry reporter for Appwrite functions. The functions run on Bun 1.0 with
 * no workspace install and load this file by relative path, so it carries no
 * imports at all: plain `fetch`, `crypto.randomUUID` and `AbortController`.
 * The scrubber below is a private copy of the patterns in `../scrub`; the
 * sync test keeps the two producing the same output.
 */

export interface MonitorConfig {
  checkinMargin: number;
  failureIssueThreshold: number;
  maxRuntime: number;
  recoveryThreshold: number;
  schedule: string;
  timezone: string;
}

export interface ReporterConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  tags?: Record<string, string>;
  timeoutMs?: number;
}

export interface CheckInOptions {
  checkInId?: string;
  durationSeconds?: number;
  monitorConfig?: MonitorConfig;
}

export interface Reporter {
  captureError(error: unknown, extraTags?: Record<string, string>): void;
  checkIn(
    slug: string,
    status: "in_progress" | "ok" | "error",
    options?: CheckInOptions
  ): string | undefined;
  enabled: boolean;
  flush(): Promise<void>;
}

const REDACTED = "[redacted]";
const DEFAULT_TIMEOUT_MS = 2000;
const MAX_FRAMES = 50;

// ---------------------------------------------------------------------------
// Scrubber (copy of ../scrub: scrubText, scrubUrl, capability paths)
// ---------------------------------------------------------------------------
const ACCOUNT_NUMBER = /\b\d{4}[ .]?\d{2}[ .]?\d{5}\b/g;
const NATIONAL_ID = /\b\d{6} ?\d{5}\b/g;
const EMAIL =
  /(^|[^A-Za-z0-9._%+-]|\+|%20|%2[Bb])[A-Za-z0-9._%+-]{1,64}(?:@|%40)[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,63}/g;
const IBAN = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b/g;
const EMBEDDED_URL = /https?:\/\/[^\s"'<>]*/g;
const SECRET_PAIR =
  /(^|[^A-Za-z0-9_])((?:[A-Za-z0-9]+[_-]){0,6}(?:secret|code|state|token|userId|password))=[^&\s"'<>#]*/gi;
const URL_SUFFIX = /[?#].*$/s;
const CAPABILITY_PATHS: RegExp[] = [
  /(^|\/\/[^/\s"'<>?#]*|[^\w.~%-])(\/fs\/approve\/)(?!\[|%5B)[^/?#\s"'<>]+/gi,
  /(^|\/\/[^/\s"'<>?#]*|[^\w.~%-])(\/recruitment\/book\/)(?!\[|%5B)[^/?#\s"'<>]+/gi,
  /(^|\/\/[^/\s"'<>?#]*|[^\w.~%-])(\/scan\/)(?!\[|%5B)[^/?#\s"'<>]+/gi,
  /(^|\/\/[^/\s"'<>?#]*|[^\w.~%-])(\/shop\/order\/)(?!\[|%5B)[^/?#\s"'<>]+/gi,
];

const dropUrlSuffix = (url: string): string => url.replace(URL_SUFFIX, "");

const redactCapabilityPaths = (text: string): string => {
  let out = text;
  for (const pattern of CAPABILITY_PATHS) {
    out = out.replace(pattern, `$1$2${REDACTED}`);
  }
  return out;
};

const scrubText = (text: string): string =>
  redactCapabilityPaths(text.replace(EMBEDDED_URL, dropUrlSuffix))
    .replace(SECRET_PAIR, `$1$2=${REDACTED}`)
    .replace(EMAIL, `$1${REDACTED}`)
    .replace(IBAN, REDACTED)
    .replace(ACCOUNT_NUMBER, REDACTED)
    .replace(NATIONAL_ID, REDACTED);

const scrubUrl = (url: string): string => scrubText(dropUrlSuffix(url));

export const __scrubForTest = { scrubText, scrubUrl };

// ---------------------------------------------------------------------------
// DSN
// ---------------------------------------------------------------------------
const DSN_PATTERN = /^https?:\/\/([^@/:\s]+)@([^/\s]+)\/(\d+)\/?$/;

interface ParsedDsn {
  host: string;
  key: string;
  projectId: string;
  scheme: string;
}

const parseDsn = (dsn: string | undefined): ParsedDsn | undefined => {
  const match = DSN_PATTERN.exec((dsn ?? "").trim());
  if (!match) {
    return;
  }
  const scheme = dsn?.trim().startsWith("http://") ? "http" : "https";
  return { scheme, key: match[1], host: match[2], projectId: match[3] };
};

// ---------------------------------------------------------------------------
// Stack frames
// ---------------------------------------------------------------------------
interface Frame {
  colno?: number;
  filename: string;
  function?: string;
  lineno?: number;
}

const FRAME_WITH_FUNCTION = /^\s*at (.+?) \((.+?)(?::(\d+))?(?::(\d+))?\)\s*$/;
const FRAME_BARE = /^\s*at (.+?)(?::(\d+))?(?::(\d+))?\s*$/;

const toFrame = (
  fn: string | undefined,
  file: string,
  line: string | undefined,
  col: string | undefined
): Frame => ({
  ...(fn ? { function: fn } : {}),
  filename: scrubUrl(file),
  ...(line ? { lineno: Number(line) } : {}),
  ...(col ? { colno: Number(col) } : {}),
});

const parseFrame = (line: string): Frame | undefined => {
  const withFn = FRAME_WITH_FUNCTION.exec(line);
  if (withFn) {
    return toFrame(withFn[1], withFn[2], withFn[3], withFn[4]);
  }
  const bare = FRAME_BARE.exec(line);
  return bare ? toFrame(undefined, bare[1], bare[2], bare[3]) : undefined;
};

const parseFrames = (stack: string | undefined): Frame[] => {
  if (!stack) {
    return [];
  }
  const frames: Frame[] = [];
  for (const line of stack.split("\n").slice(0, MAX_FRAMES + 1)) {
    const frame = parseFrame(line);
    if (frame) {
      frames.push(frame);
    }
  }
  return frames.reverse();
};

// ---------------------------------------------------------------------------
// Reporter
// ---------------------------------------------------------------------------
const scrubTags = (tags: Record<string, string>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const key of Object.keys(tags)) {
    out[key] = scrubText(String(tags[key]));
  }
  return out;
};

const describe = (
  error: unknown
): { stack?: string; type: string; value: string } => {
  if (error instanceof Error) {
    return {
      type: error.name || "Error",
      value: scrubText(error.message),
      stack: error.stack,
    };
  }
  return { type: "Error", value: scrubText(String(error)) };
};

const hexId = (): string => crypto.randomUUID().replace(/-/g, "");

const inertReporter = (): Reporter => ({
  enabled: false,
  captureError: () => undefined,
  checkIn: () => undefined,
  flush: () => Promise.resolve(),
});

export function createReporter(config: ReporterConfig): Reporter {
  const dsn = parseDsn(config.dsn);
  if (!dsn) {
    return inertReporter();
  }
  const base = `${dsn.scheme}://${dsn.host}/api/${dsn.projectId}`;
  const environment = config.environment ?? "production";
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pending = new Set<Promise<void>>();
  const controllers = new Set<AbortController>();

  const send = (url: string, contentType: string, body: string): void => {
    try {
      const controller = new AbortController();
      controllers.add(controller);
      const request = Promise.resolve()
        .then(() =>
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": contentType },
            body,
            signal: controller.signal,
          })
        )
        .then(
          () => undefined,
          () => undefined
        )
        .then(() => {
          pending.delete(request);
          controllers.delete(controller);
        });
      pending.add(request);
    } catch {
      // a reporter never throws into the function
    }
  };

  const captureError = (
    error: unknown,
    extraTags?: Record<string, string>
  ): void => {
    try {
      const { type, value, stack } = describe(error);
      const frames = parseFrames(stack);
      const eventId = hexId();
      const event = {
        event_id: eventId,
        timestamp: Date.now() / 1000,
        platform: "javascript",
        level: "error",
        environment,
        ...(config.release ? { release: config.release } : {}),
        tags: scrubTags({ ...config.tags, ...extraTags }),
        exception: {
          values: [
            {
              type,
              value,
              ...(frames.length > 0 ? { stacktrace: { frames } } : {}),
            },
          ],
        },
      };
      const body = [
        JSON.stringify({
          event_id: eventId,
          sent_at: new Date().toISOString(),
        }),
        JSON.stringify({ type: "event" }),
        JSON.stringify(event),
      ].join("\n");
      send(
        `${base}/envelope/?sentry_key=${dsn.key}&sentry_version=7`,
        "application/x-sentry-envelope",
        body
      );
    } catch {
      // drop the report
    }
  };

  const checkIn: Reporter["checkIn"] = (slug, status, options) => {
    try {
      const checkInId = options?.checkInId ?? crypto.randomUUID();
      const monitor = options?.monitorConfig;
      const body = {
        status,
        check_in_id: checkInId,
        environment,
        ...(options?.durationSeconds === undefined
          ? {}
          : { duration: options.durationSeconds }),
        ...(monitor
          ? {
              monitor_config: {
                schedule: { type: "crontab", value: monitor.schedule },
                checkin_margin: monitor.checkinMargin,
                max_runtime: monitor.maxRuntime,
                failure_issue_threshold: monitor.failureIssueThreshold,
                recovery_threshold: monitor.recoveryThreshold,
                timezone: monitor.timezone,
              },
            }
          : {}),
      };
      const query = `status=${encodeURIComponent(status)}&check_in_id=${encodeURIComponent(checkInId)}&environment=${encodeURIComponent(environment)}`;
      send(
        `${base}/cron/${encodeURIComponent(slug)}/${dsn.key}/?${query}`,
        "application/json",
        JSON.stringify(body)
      );
      return checkInId;
    } catch {
      return;
    }
  };

  const flush = async (): Promise<void> => {
    if (pending.size === 0) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      });
      await Promise.race([
        Promise.all([...pending]).then(() => undefined),
        deadline,
      ]);
    } catch {
      // never rejects
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      for (const controller of controllers) {
        controller.abort();
      }
      controllers.clear();
      pending.clear();
    }
  };

  return { enabled: true, captureError, checkIn, flush };
}

export function reporterFromEnv(
  env: Record<string, string | undefined>,
  functionName: string
): Reporter {
  const deployment = env.APPWRITE_FUNCTION_DEPLOYMENT;
  return createReporter({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT || "production",
    ...(deployment ? { release: `biso-functions@${deployment}` } : {}),
    tags: { function: functionName },
  });
}
