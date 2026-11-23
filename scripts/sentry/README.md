# Sentry platform health dashboard

`platform-health-dashboard.json` defines the "BISO platform health" dashboard
in the `bi-student-organisation` Sentry org (EU region). `apply-dashboard.ts`
creates it, or updates it in place if a dashboard with that title exists.

```bash
read -rs SENTRY_DASHBOARD_TOKEN && export SENTRY_DASHBOARD_TOKEN
bun scripts/sentry/apply-dashboard.ts
```

Don't put the token on the command line: it would stay in your shell history.
`read -rs` takes it without echoing it. `bun --env-file=<file>` also works if
the token is in a file that git ignores.

The token is a personal auth token with the `org:write` scope. The script
prints the dashboard URL and exits non-zero on API errors.

The JSON in this repo is the source of truth. Edit it here and re-apply;
changes made in the Sentry UI are overwritten on the next run. Run
`bun test scripts/sentry` to check the definition.
