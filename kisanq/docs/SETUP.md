# Local and Supabase setup

## Requirements

- Node.js 22.x recommended for this development environment.
- npm 10.x or a compatible npm release.
- A Supabase project for phone OTP, PostgreSQL, and optional private Storage.

## Install and run

```bash
cp .env.example .env.local
npm install
npm run dev
```

Without Supabase credentials, the pages can render clearly labeled demonstration material. Protected API mutations fail closed and do not claim data was saved.

## Supabase environment

Set the following in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: publishable/anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key for the secured scheduled expiry endpoint; never expose it to the browser.
- `CRON_SECRET`: long random secret used by the scheduled endpoint.
- `NEXT_PUBLIC_APP_URL`: local or deployed app origin.

Do not commit `.env.local`. Never use a service-role key for normal user requests.

## Apply schema and seed

Install the Supabase CLI using its official distribution method, authenticate, link your project, then apply migrations and seed the demo market/slot data:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase db query --file supabase/seed.sql
```

Use the exact commands supported by your installed Supabase CLI version; if `db query --file` is unavailable in that version, execute `supabase/seed.sql` through the Supabase SQL Editor. The seed is repeatable and price observations are explicitly `simulated_demo`.

## Phone OTP and roles

1. In Supabase Authentication, enable phone sign-in and configure a supported SMS provider with the provider's real credentials.
2. Configure OTP expiry, request/verification rate limits, abuse protection and redirect URLs in the provider/dashboard settings. These settings are project/provider controlled; code alone cannot guarantee their values.
3. Public sign-up creates a `farmer` profile only. The selected login role is checked against the stored profile and never grants permissions.
4. Provision buyers, inspectors, and supervisors using a trusted administrator workflow. Example SQL (run only from the trusted SQL editor after verifying the target user ID):

```sql
update public.profiles set role = 'buyer' where id = 'AUTH_USER_UUID';
update public.profiles set role = 'inspector', mandi_scope = ARRAY['11111111-1111-4111-8111-111111111111'::uuid] where id = 'AUTH_USER_UUID';
update public.profiles set role = 'supervisor' where id = 'AUTH_USER_UUID';
```

Do not expose these role changes through a public API. Inspector `mandi_scope = NULL` means no assigned mandi scope (no operational access); assign a specific array for least privilege. Use the supervisor role only for explicitly approved cross-mandi oversight.

## Storage and crop photos

A private crop-photo bucket and strict size/content/policy controls are not fully wired into the UI yet. The photo picker is disabled intentionally. Do not enable uploads until private bucket policies, MIME and byte-size checks, signed URL behavior, and cleanup have been tested.

## Scheduled expiry

`vercel.json` declares a 15-minute cron schedule for `/api/cron/expire-offers`. Set `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and Supabase URL in deployment settings. Confirm that the deployed Vercel plan supports the required schedule and verify an authorized invocation in deployment logs. A file declaration is not proof that the schedule is active. Local invocation example:

```bash
curl -X POST http://localhost:3000/api/cron/expire-offers -H "Authorization: Bearer $CRON_SECRET"
```

The handler refuses to run without a matching bearer secret and service-role configuration.

## Tests and checks

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

RLS tests against real Supabase roles and browser E2E tests require configured dependencies and credentials. Report any skipped test honestly.
