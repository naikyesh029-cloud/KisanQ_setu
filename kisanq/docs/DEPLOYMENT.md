# Deployment guide

## Vercel + Supabase

1. Create a Vercel project for this Next.js app and a separate Supabase project.
2. Add only the documented environment variables to the appropriate Vercel environments. `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` must remain server-side secrets.
3. Apply reviewed SQL migrations to Supabase, then run the explicitly simulated seed only in a demo/development project.
4. Configure phone OTP and provider limits, site/redirect URLs, and trusted role provisioning.
5. Confirm `vercel.json` cron support and schedule limits for the selected Vercel plan. Configure `CRON_SECRET`, then observe a successful cron invocation before describing expiry automation as active.
6. Run a post-deploy smoke test for farmer registration, buyer offer, slot reservation, inspection override, dispute update, ledger verification, locale switching, and sign-out/session expiry.

## Release checklist

- [ ] Build/typecheck/lint/test commands pass on CI.
- [ ] Supabase migrations apply from a clean database.
- [ ] RLS integration tests pass with separate roles, including cross-owner denial.
- [ ] OTP provider, expiry, rate limits and abuse controls are tested.
- [ ] Private Storage bucket policies are verified before enabling photo uploads.
- [ ] Market feed provenance is verified or demo-only labels remain visible.
- [ ] Cron authentication, idempotency and retry behavior are tested in deployment.
- [ ] Ledger hash chain verification passes against production-format payloads.
- [ ] Backup/restore and migration rollback procedures are tested.
- [ ] No secrets are present in client bundles or repository history.

## Rollback and recovery

Back up the database before schema changes. Prefer forward-only corrective migrations for production. If a migration fails, inspect its transaction/error output and current schema before retrying; do not blindly rerun non-idempotent statements. Restore data from the Supabase backup/PITR facility available to the project plan when necessary. After rollback/recovery, re-run schema, RLS, ledger and business-workflow checks.

A deployment is not considered complete until a real deployment and smoke tests have been observed.
