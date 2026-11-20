/**
 * Creates or updates the "BISO platform health" Sentry dashboard from
 * platform-health-dashboard.json.
 *
 * Usage: SENTRY_DASHBOARD_TOKEN=... bun scripts/sentry/apply-dashboard.ts
 *
 * Token: a personal (user) auth token. Per the Sentry API docs, the dashboard
 * create/update endpoints accept one of the scopes org:read, org:write or
 * org:admin; org:write is the smallest that is semantically right.
 */
import dashboard from "./platform-health-dashboard.json";

const ORG = "bi-student-organisation";
const API = `https://de.sentry.io/api/0/organizations/${ORG}/dashboards/`;
const WEB = `https://${ORG}.sentry.io/dashboard`;

const token = process.env.SENTRY_DASHBOARD_TOKEN;
if (!token) {
  console.error("SENTRY_DASHBOARD_TOKEN is not set (needs org:write scope).");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

async function call(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    console.error(
      `Sentry API ${res.status} for ${init?.method ?? "GET"} ${url}\n${text}`
    );
    process.exit(res.status >= 400 && res.status < 500 ? 2 : 3);
  }
  return JSON.parse(text);
}

const found = (await call(
  `${API}?query=${encodeURIComponent(dashboard.title)}`
)) as {
  id: string;
  title: string;
}[];
const existing = found.find((d) => d.title === dashboard.title);

const result = (await (existing
  ? call(`${API}${existing.id}/`, {
      method: "PUT",
      body: JSON.stringify(dashboard),
    })
  : call(API, { method: "POST", body: JSON.stringify(dashboard) }))) as {
  id: string;
};

console.log(
  `${existing ? "Updated" : "Created"} dashboard: ${WEB}/${result.id}/`
);
