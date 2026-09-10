import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

// `server-only` throws outside a Server Component; neutralise it so the module
// under test can be imported here.
mock.module("server-only", () => ({}));

const { isSmtpConfigured, readSmtpConfig } = await import("./smtp");

const SMTP_KEYS = [
  "SMTP_FROM",
  "SMTP_HOST",
  "SMTP_PASSWORD",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
] as const;

const originalEnv = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of SMTP_KEYS) {
    originalEnv.set(key, process.env[key]);
    process.env[key] = undefined;
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of SMTP_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("readSmtpConfig", () => {
  test("returns null until both SMTP_HOST and SMTP_FROM are set", () => {
    expect(readSmtpConfig()).toBeNull();
    expect(isSmtpConfigured()).toBe(false);

    process.env.SMTP_HOST = "smtp.office365.com";
    expect(readSmtpConfig()).toBeNull();

    process.env.SMTP_FROM = "BISO <noreply@biso.no>";
    expect(readSmtpConfig()).not.toBeNull();
    expect(isSmtpConfigured()).toBe(true);
  });

  test("defaults to STARTTLS on 587 rather than implicit TLS", () => {
    process.env.SMTP_HOST = "smtp.office365.com";
    process.env.SMTP_FROM = "noreply@biso.no";

    const config = readSmtpConfig();

    expect(config?.port).toBe(587);
    // Getting this wrong hangs the connection instead of failing loudly.
    expect(config?.secure).toBe(false);
  });

  test("infers implicit TLS from port 465", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_FROM = "noreply@biso.no";
    process.env.SMTP_PORT = "465";

    expect(readSmtpConfig()?.secure).toBe(true);
  });

  test("lets SMTP_SECURE override the port-derived default", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_FROM = "noreply@biso.no";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "false";

    expect(readSmtpConfig()?.secure).toBe(false);
  });

  test("falls back to 587 for an unparseable port", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_FROM = "noreply@biso.no";
    process.env.SMTP_PORT = "not-a-number";

    expect(readSmtpConfig()?.port).toBe(587);
  });

  test("leaves credentials undefined for an IP-authenticated relay", () => {
    process.env.SMTP_HOST = "smtp.internal";
    process.env.SMTP_FROM = "noreply@biso.no";

    const config = readSmtpConfig();

    expect(config?.user).toBeUndefined();
    expect(config?.password).toBeUndefined();
  });
});
