# Sentry platform health dashboard

`platform-health-dashboard.json` defines the "BISO platform health" dashboard
in the `bi-student-organisation` Sentry org (EU region). `apply-dashboard.ts`
creates it, or updates it in place if a dashboard with that title exists.

```bash
SENTRY_DASHBOARD_TOKEN=... bun scripts/sentry/apply-dashboard.ts
```

The token is a personal auth token with the `org:write` scope. The script
prints the dashboard URL and exits non-zero on API errors.

The JSON in this repo is the source of truth. Edit it here and re-apply;
changes made in the Sentry UI are overwritten on the next run. Run
`bun test scripts/sentry` to check the definition.
