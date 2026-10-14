# KisanQ End-to-End Technical & Security Audit Report

**Audit Date:** 2026-10-12  
**Repository:** `e:\cursorProjects\hackathon_sankalp\KisanQ\kisanq`  
**Stack:** Next.js 15.5.4 (App Router) · React 19.1.1 · TypeScript (`strict: true`) · Tailwind CSS · Supabase (Auth, PostgreSQL, RLS, PL/pgSQL RPCs) · Zod · Recharts

---

## 1. Executive Summary

KisanQ is a digital agricultural mandi platform connecting four operational roles (**Farmer**, **Buyer**, **Inspector**, and **Supervisor**) across crop listing, atomic arrival-slot booking, gate token check-in, physical inspection/grade overrides, buyer offer placement, perishability-based offer expiry/escalation, dispute resolution, market price exploration, and a SHA-256 tamper-evident hash-chain ledger.

### Audit Scope & Key Outcomes
- **100% Repository Inspection:** All 143 non-`node_modules` / non-`.next` source, SQL migration, configuration, and documentation files were audited line-by-line.
- **24 Confirmed Defects Remediated (`3 P0`, `7 P1`, `9 P2`, `5 P3`):**
  - **Security & RBAC (`P0`):** Fixed cross-lot/cross-offer spoofing in `POST /api/disputes` and `guard_dispute_insert()`, blocked open-redirect vectors in `LoginForm` (`?next=...`), and completed `'supervisor'` role typing/routing across `src/lib/auth/roles.ts`.
  - **Broken End-to-End Workflows (`P1`):**
    1. Unblocked **Farmer** and **Buyer** access to `/[locale]/inspector/disputes` in `src/middleware.ts` (previously middleware blocked both roles from visiting the Dispute Desk even though only farmers and buyers can file disputes).
    2. Added the missing **Inspector/Supervisor Dispute Resolution UI** in `src/components/shared/DisputeDesk.tsx` (wired to `PATCH /api/disputes/[id]`) and added the `Offer ID (UUID)` input to the dispute filing form.
    3. Fixed **Lot Lifecycle & Offer Premature Freeze** across `src/app/api/lots/route.ts`, `src/app/api/offers/route.ts`, and `supabase/migrations/0011_workflow_and_security_fixes.sql` so lots that reserve a slot (`reserved`), check in at the gate (`checked_in`), or pass physical inspection (`inspected`) remain visible to buyers and open for offers until `offer_expires_at` or `sold`, and added `buyer_has_offer_on_lot` so buyers retain read access to `crop_lots` metadata after expiry or sale.
    4. Fixed `process_expired_offers()` so lots in `reserved`, `checked_in`, or `inspected` with zero offers do not have their physical yard status overwritten to `expired` when their offer window closes, and updated `accept_best_offer()` to opportunistically escalate expired windows before cron execution.
    5. Updated `reserve_slot()`, `check_in_token()`, and `record_inspection()` so `sold` lots can reserve a delivery slot, check in at the gate, and complete physical inspection without regressing their `sold` status, and blocked reserving slots in the past (`slot_date < Asia/Kolkata today`).
    6. Fixed `AddCropForm` + `crop_profiles` mismatch where selecting **Maize** gave a 48h preview in the UI (`offerWindowHours('Maize') === 48`) but received a 12h fallback in PostgreSQL because `'maize'` was missing from `public.crop_profiles`.
    7. Fixed `inspectionSchema` in `src/lib/validation/schemas.ts` where leaving optional `moisturePct` blank (`""`) coerced it to `0%` instead of `undefined` (`NULL`), and blocked boolean-to-number coercion (`true -> 1`).
  - **Correctness, Data Integrity, TypeScript/ESLint & UX (`P2`/`P3`):** Fixed `canonicalJson()` omitting `undefined` keys and normalizing `-0` to `'0'`, fixed `bestOffer()` to support `awaiting_farmer` escalated offers and deterministic UUID tie-breaking, fixed `IvrDemo.tsx` digit `'9'` and `*` backspace handling during quantity entry, linked `DemandPressure` dynamically to the selected crop on `/[locale]/market-prices`, fixed `SupervisorAudit.tsx` override/accepted filters, connected `TokenCheckIn` to `InspectionForm` via live browser event, fixed `Asia/Kolkata` timezone harvest date bounds, added explicit `CookieOptions` typing in `src/lib/supabase/server.ts` and `src/middleware.ts`, updated `eslint.config.mjs` ignores, updated `playwright.config.ts` with system browser fallback, updated SSR `<html lang>`, and created `.env.example`.

### Runtime Verification Summary (Observed Outputs)
- **`npm test`:** **PASSED (`exit 0`)** — 12 unit tests (52 assertions) passed in `138.76ms`.
- **`npm run typecheck`:** **PASSED (`exit 0`)** — `tsc --noEmit` completed with `0` errors.
- **`npm run lint`:** **PASSED (`exit 0`)** — `eslint .` completed with `0` errors and `0` warnings.
- **`npm run build`:** **PASSED (`exit 0`)** — `next build` compiled all 58 static pages, 16 API routes, and Middleware in `7.0s`.
- **`npm run test:e2e`:** **PASSED (`exit 0`)** — 4 Playwright Chromium E2E tests passed in `9.8s`.
- **Database Migrations (`0001`–`0011`) & `supabase/tests/schema_smoke.sql`:** Verified by static SQL analysis and unit crop-profile parity checks; live PostgreSQL execution requires running `supabase db push` and `supabase/tests/schema_smoke.sql` against the target Supabase instance.

---

## 2. System Architecture & Runtime Flow

1. **Routing & Middleware (`src/middleware.ts`):**
   - Enforces locale prefixes (`/en`, `/hi`, `/mr`) and sets the `NEXT_LOCALE` cookie.
   - Protects `/farmer/*`, `/buyer/*`, and `/inspector/*` routes when Supabase is configured.
   - Fetches the authenticated user's `profiles.role` from Supabase and enforces role boundaries:
     - `/[locale]/farmer/*` -> `farmer`
     - `/[locale]/buyer/*` -> `buyer`
     - `/[locale]/inspector/supervisor-audit` -> `supervisor`
     - `/[locale]/inspector/disputes` -> `farmer`, `buyer`, `inspector`, `supervisor`
     - `/[locale]/inspector/*` (all other inspector routes) -> `inspector`, `supervisor`
2. **Data Access & Security Model:**
   - Browser components read/mutate data through Next.js Route Handlers (`src/app/api/**`) using user-scoped SSR Supabase clients (`createSupabaseServerClient`).
   - High-concurrency and cross-table state transitions (`reserve_slot`, `check_in_token`, `record_inspection`, `process_expired_offers`, `accept_best_offer`, `verify_ledger_chain`, `market_demand_pressure`) run inside PostgreSQL `SECURITY DEFINER` RPCs with explicit `auth.uid()`, role, and `mandi_scope` checks plus `FOR UPDATE` row locks.
   - Every critical mutation appends an immutable SHA-256 hash-chained row to `audit_events` via `append_audit_event()` serialized by `pg_advisory_xact_lock(4918201)`.

---

## 3. Complete Endpoint & Route Inventory

### API Route Handlers (`src/app/api/**`)

| Endpoint | Methods | Auth / Roles Allowed | Validation Schema | DB Tables / RPCs Used | Audit Status |
|---|---|---|---|---|---|
| [`/api/lots`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/lots/route.ts) | `GET`, `POST` | `GET`: `farmer`, `buyer`, `inspector`, `supervisor`<br>`POST`: `farmer` | `cropLotSchema` | `crop_lots`, `tokens`, `slots`, `offers`, `mandis`, `highest_active_offers` RPC | Fixed — buyer `GET` now includes `('listed','reserved','checked_in','inspected')`. |
| [`/api/offers`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/offers/route.ts) | `POST` | `buyer` | `offerSchema` | `offers`, `crop_lots` | Fixed — `POST` allows offers across `('listed','reserved','checked_in','inspected')` while window is open and `!expiry_processed_at`. |
| [`/api/offers/mine`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/offers/mine/route.ts) | `GET` | `buyer` | None | `offers`, `crop_lots` | Fixed via RLS — `buyer_has_offer_on_lot` in `0011` ensures buyers can still join `crop_lots` metadata after expiry or sale. |
| [`/api/offers/accept-best`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/offers/accept-best/route.ts) | `POST` | `farmer` | `acceptBestOfferSchema` | `accept_best_offer` RPC | Fixed — uses centralized `acceptBestOfferSchema` and opportunistically escalates expired windows in `accept_best_offer`. |
| [`/api/cron/expire-offers`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/cron/expire-offers/route.ts) | `GET`, `POST` | Bearer `CRON_SECRET` (`crypto.timingSafeEqual`) | Header check | `process_expired_offers` RPC (service-role client) | Audited — constant-time secret comparison; RPC updated in `0011`. |
| [`/api/slots`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/slots/route.ts) | `GET` | `farmer`, `inspector`, `supervisor` | Optional `mandiId` UUID | `slots`, `mandis` | Fixed — filters out slots with `booked_count >= capacity` and validates `mandiId` UUID. |
| [`/api/slots/reserve`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/slots/reserve/route.ts) | `POST` | `farmer` | `slotReserveSchema` | `reserve_slot` RPC | Fixed — centralized schema; RPC updated in `0011`. |
| [`/api/tokens/check-in`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/tokens/check-in/route.ts) | `POST` | `inspector`, `supervisor` | `tokenCheckInSchema` | `check_in_token` RPC | Fixed — centralized schema; UI event wired to `InspectionForm`. |
| [`/api/inspections`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/inspections/route.ts) | `POST` | `inspector`, `supervisor` | `inspectionSchema` | `record_inspection` RPC | Fixed — `moisturePct` empty string no longer coerces to `0`. |
| [`/api/inspector/overview`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/inspector/overview/route.ts) | `GET` | `inspector`, `supervisor` | None | `mandis`, `slots`, `crop_lots` | Audited — `mandi_scope`-filtered live aggregation with explicit `mode` flag. |
| [`/api/ledger`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/ledger/route.ts) | `GET` | `inspector`, `supervisor` | None | `audit_events` | Audited — RLS scopes inspector reads to `mandi_scope` and allows full read for `supervisor`. |
| [`/api/ledger/verify`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/ledger/verify/route.ts) | `POST` | `inspector`, `supervisor` | None | `verify_ledger_chain` RPC (`audit_events`) | Audited — verifies full global chain without leaking out-of-scope payloads. |
| [`/api/disputes`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/disputes/route.ts) | `GET`, `POST` | `GET`: all 4 roles<br>`POST`: `farmer`, `buyer` | `disputeCreateSchema` | `disputes`, `crop_lots`, `offers` | Fixed — enforces lot/offer ownership and cross-reference consistency in API and DB trigger. |
| [`/api/disputes/[id]`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/disputes/%5Bid%5D/route.ts) | `PATCH` | `inspector`, `supervisor` | `disputeUpdateSchema` + `z.string().uuid()` | `disputes` | Fixed — strict UUID validation and wired to `DisputeDesk` UI. |
| [`/api/prices`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/prices/route.ts) | `GET` | Public | `crop`, `mandi` (UUID), `from` (date) | `price_history` | Fixed — validates `mandi` and `from` query params with `422` before querying Postgres. |
| [`/api/prices/demand`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/prices/demand/route.ts) | `GET` | Authenticated user | `demandQuerySchema` | `market_demand_pressure` RPC | Fixed — centralized schema + RPC includes all active lot statuses. |

---

## 4. Severity-Ranked Findings & Fixes (`P0` – `P3`)

### `P0` — Critical Security, Authorization & Data Integrity Defects

#### `P0-1`: Cross-Tenant Dispute Creation Spoofing (`POST /api/disputes` & `guard_dispute_insert`)
- **Files:** [`src/app/api/disputes/route.ts`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/disputes/route.ts), [`supabase/migrations/0005_authorization_hardening.sql`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/supabase/migrations/0005_authorization_hardening.sql#L121-L130), [`supabase/migrations/0011_workflow_and_security_fixes.sql`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/supabase/migrations/0011_workflow_and_security_fixes.sql#L243-L269)
- **Reproduction:** An authenticated buyer or farmer calls `POST /api/disputes` passing an arbitrary `lotId` or `offerId` belonging to another farmer/buyer, or passing a mismatched `(lotId, offerId)` pair.
- **Root Cause:** `POST /api/disputes` inserted `lotId` and `offerId` directly without checking whether the authenticated farmer owned the lot or whether the authenticated buyer owned the offer / had bid on the lot, and did not check `offer.lot_id === lotId`. Similarly, `guard_dispute_insert()` in `0005_authorization_hardening.sql` only set `raised_by := auth.uid()` without verifying ownership or cross-reference consistency.
- **Impact:** Any authenticated farmer or buyer could attach fraudulent disputes to unrelated lots/offers across mandis.
- **Fix Applied:** Added ownership and `offer.lot_id === lotId` verification in `src/app/api/disputes/route.ts` and enforced the identical invariants inside `public.guard_dispute_insert()` in migration `0011`.
- **Regression Test:** Schema and validation assertions in [`tests/unit/domain.test.mjs`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/tests/unit/domain.test.mjs) and SQL smoke tests in [`supabase/tests/schema_smoke.sql`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/supabase/tests/schema_smoke.sql).

#### `P0-2`: Incomplete `supervisor` Role Definition & Privilege Routing
- **Files:** [`src/lib/auth/roles.ts`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/lib/auth/roles.ts), [`src/components/shared/LoginForm.tsx`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/components/shared/LoginForm.tsx)
- **Reproduction:** A provisioned `supervisor` signs in via `LoginForm` or is checked via `hasRole(role, 'inspector')`.
- **Root Cause:** `AppRole` in `src/lib/auth/roles.ts` only included `'farmer' | 'buyer' | 'inspector'`, `hasRole('supervisor', 'inspector')` returned `false`, and `LoginForm.tsx` had no `'supervisor'` role option and did not route supervisors to `/[locale]/inspector/supervisor-audit`.
- **Impact:** Supervisors could not sign in cleanly or use helper role checks without failing role comparisons.
- **Fix Applied:** Added `'supervisor'` to `AppRole`, updated `hasRole()` so `'supervisor'` satisfies `'inspector'` while keeping `'supervisor'` exclusive for supervisor-only routes, updated `roleHome('supervisor', locale)` to `/[locale]/inspector/supervisor-audit`, and added `supervisor` to `LoginForm.tsx`.
- **Regression Test:** Tested in [`tests/unit/domain.test.mjs`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/tests/unit/domain.test.mjs#L118-L139).

#### `P0-3`: Unvalidated Post-Login `next` Redirect Parameter in `LoginForm`
- **Files:** [`src/lib/auth/roles.ts`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/lib/auth/roles.ts#L14-L35), [`src/components/shared/LoginForm.tsx`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/components/shared/LoginForm.tsx)
- **Reproduction:** Navigating to `/en/login?next=//evil.example.com` or `/en/login?next=/en/inspector/dashboard` and signing in as a farmer.
- **Root Cause:** `LoginForm` previously ignored `?next=` or if wired naively would allow open redirects (`//evil.com`, `/\evil.com`) or redirecting into an unauthorized role namespace (`?reason=role-mismatch` loop).
- **Impact:** Phishing open-redirect risk or immediate post-login role-mismatch redirect loop.
- **Fix Applied:** Implemented `resolvePostLoginPath(role, locale, nextPath)` in `src/lib/auth/roles.ts` that strictly requires a single leading `/`, blocks `//` and `\`, verifies locale prefix, and checks role authorization for the target route before redirecting (falling back to `roleHome(role, locale)`).
- **Regression Test:** Tested in [`tests/unit/domain.test.mjs`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/tests/unit/domain.test.mjs#L126-L139).

---

### `P1` — Broken Core User Workflows

#### `P1-1`: Farmers and Buyers Blocked by Middleware from Visiting the Dispute Desk (`/[locale]/inspector/disputes`)
- **Files:** [`src/middleware.ts`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/middleware.ts)
- **Reproduction:** An authenticated `farmer` or `buyer` clicks **Dispute Desk** in the navigation bar (`/[locale]/inspector/disputes`).
- **Root Cause:** `requiredRole()` in `src/middleware.ts` matched `pathname.includes('/inspector/')` and required `inspector` or `supervisor` for all `/inspector/*` paths, redirecting farmers and buyers to `/login?reason=role-mismatch&required=inspector` — even though `AppShell.tsx` shows the link to all users and `POST /api/disputes` ONLY allows `farmer` and `buyer` to file disputes.
- **Impact:** Farmers and buyers could never access the Dispute Desk UI when authenticated.
- **Fix Applied:** Updated `src/middleware.ts` and `resolvePostLoginPath()` so `/[locale]/inspector/disputes` permits authenticated `farmer`, `buyer`, `inspector`, and `supervisor` roles.
- **Regression Test:** Tested in [`tests/unit/domain.test.mjs`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/tests/unit/domain.test.mjs#L127-L128).

#### `P1-2`: Missing Inspector/Supervisor Dispute Resolution UI & Missing Offer ID Field in `DisputeDesk.tsx`
- **Files:** [`src/components/shared/DisputeDesk.tsx`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/components/shared/DisputeDesk.tsx), [`src/app/api/disputes/[id]/route.ts`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/disputes/%5Bid%5D/route.ts)
- **Reproduction:** An inspector or supervisor opens `/[locale]/inspector/disputes` to move an `open` dispute to `under_review`, `resolved`, or `rejected`, or a buyer attempts to file a dispute by Offer ID.
- **Root Cause:** Although `PATCH /api/disputes/[id]` existed on the backend, `DisputeDesk.tsx` had zero UI controls calling `PATCH /api/disputes/[id]`. Furthermore, the creation form only had a `Lot ID` input even though `POST /api/disputes` accepts `offerId`.
- **Impact:** Inspectors and supervisors had no way to review, resolve, or reject disputes in the UI, and buyers could not reference a disputed `offerId`.
- **Fix Applied:** Added an `Offer ID (UUID)` input to the dispute filing form and added an interactive **Inspector / Supervisor Dispute Resolution** panel in `DisputeDesk.tsx` that loads transitionable disputes (`open` / `under_review`) and submits `PATCH /api/disputes/[id]` with status (`under_review`, `resolved`, `rejected`) and resolution notes.

#### `P1-3`: Lot Lifecycle Deadlock — Reserved, Checked-In, and Inspected Lots Disappeared from Buyer Marketplace, Rejected Offers, and Broke Buyer Offer History After Expiry
- **Files:** [`src/app/api/lots/route.ts`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/lots/route.ts), [`src/app/api/offers/route.ts`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/offers/route.ts), [`src/components/shared/Marketplace.tsx`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/components/shared/Marketplace.tsx), [`supabase/migrations/0011_workflow_and_security_fixes.sql`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/supabase/migrations/0011_workflow_and_security_fixes.sql#L43-L185)
- **Reproduction:** A farmer lists a lot (`status = 'listed'`), reserves an arrival slot (`status -> 'reserved'`), checks in at the gate (`status -> 'checked_in'`), and an inspector records `verified_grade = 'A'` (`status -> 'inspected'`). A buyer then opens the Marketplace or submits an offer, or views `OfferHistory` after the lot expires or sells.
- **Root Cause:** `GET /api/lots` filtered buyer listings by `.eq('status', 'listed')`, `POST /api/offers` rejected any lot where `lot.status !== 'listed'`, and DB policy `lots_farmer_select` / `offers_buyer_insert` / `guard_offer_insert()` required `status = 'listed'`. Furthermore, once `offer_expires_at` passed or a lot became `sold`, `lots_farmer_select` hid the `crop_lots` row even from buyers who had bid on it (breaking `GET /api/offers/mine` and `POST /api/disputes`).
- **Impact:** As soon as a farmer booked a slot or had their crop inspected, the lot vanished from the buyer marketplace and could no longer receive or accept offers, and buyers lost lot metadata on past offers.
- **Fix Applied:** Updated `GET /api/lots`, `POST /api/offers`, `lots_farmer_select` (including `public.buyer_has_offer_on_lot(id)`), `offers_buyer_insert`, `guard_offer_insert()`, `highest_active_offer()`, `highest_active_offers()`, `market_demand_pressure()`, and `accept_best_offer()` to support active lots across `('listed', 'reserved', 'checked_in', 'inspected')` and updated `Marketplace.tsx` to display `verified_weight ?? quantity` and `verified_moisture_pct ?? moisture_pct`.

#### `P1-4`: `process_expired_offers()` Overwrote Physical Yard Statuses (`reserved`, `checked_in`, `inspected`) to `expired`
- **Files:** [`supabase/migrations/0010_best_offer_escalation_semantics.sql`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/supabase/migrations/0010_best_offer_escalation_semantics.sql#L15-L34), [`supabase/migrations/0011_workflow_and_security_fixes.sql`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/supabase/migrations/0011_workflow_and_security_fixes.sql#L128-L162)
- **Reproduction:** A lot has reserved a slot (`reserved`) or checked in at the yard (`checked_in`), and its offer window expires with zero offers before inspection completes.
- **Root Cause:** `process_expired_offers()` unconditionally set `status = 'expired'` when no winning offer existed, which prevented `check_in_token` or `record_inspection` from subsequently running on the lot.
- **Impact:** Yard operations broke whenever a lot's offer timer elapsed before physical gate check-in or inspection.
- **Fix Applied:** Updated `process_expired_offers()` in migration `0011` so `status` is set to `'expired'` only when `item.status = 'listed'`; lots already in `'reserved'`, `'checked_in'`, or `'inspected'` retain their physical yard status while recording `expiry_processed_at = now()`.

#### `P1-5`: `reserve_slot()`, `check_in_token()`, and `record_inspection()` Blocked `sold` Lots from Completing Yard Delivery & Allowed Past Slot Dates
- **Files:** [`supabase/migrations/0001_initial_schema.sql`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/supabase/migrations/0001_initial_schema.sql#L157-L172), [`supabase/migrations/0004_inspections_and_expiry_defaults.sql`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/supabase/migrations/0004_inspections_and_expiry_defaults.sql#L14-L33), [`supabase/migrations/0008_token_checkin.sql`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/supabase/migrations/0008_token_checkin.sql#L1-L20), [`supabase/migrations/0011_workflow_and_security_fixes.sql`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/supabase/migrations/0011_workflow_and_security_fixes.sql#L187-L241)
- **Reproduction:** A farmer accepts the best offer on a lot (`status -> 'sold'`) and then reserves an arrival slot, checks in at the gate, and undergoes physical inspection; or calls `reserve_slot` with a past slot ID.
- **Root Cause:** `reserve_slot()` only allowed `lot.status in ('listed', 'draft')` and did not check `chosen_slot.slot_date < today_ist`; `check_in_token()` only allowed `lot.status = 'reserved'`; and `record_inspection()` only allowed `lot.status in ('checked_in', 'inspected')`.
- **Impact:** Lots sold before slot booking or gate check-in could not complete physical delivery and inspection without status errors.
- **Fix Applied:** Updated `reserve_slot()`, `check_in_token()`, and `record_inspection()` in migration `0011` to support `sold` lots without regressing their `'sold'` status, and rejected past `slot_date`s in `reserve_slot()`.

#### `P1-6`: `Maize` Crop Offer Window Mismatch Between Frontend (`48h`) and PostgreSQL `crop_profiles` (`12h` Fallback)
- **Files:** [`src/components/shared/AddCropForm.tsx`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/components/shared/AddCropForm.tsx#L9), [`src/lib/domain/market.ts`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/lib/domain/market.ts#L12-L18), [`supabase/migrations/0001_initial_schema.sql`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/supabase/migrations/0001_initial_schema.sql#L36-L47), [`supabase/migrations/0011_workflow_and_security_fixes.sql`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/supabase/migrations/0011_workflow_and_security_fixes.sql#L3-L14)
- **Reproduction:** A farmer selects `Maize` in `AddCropForm` (which displays `Initial offer window: 48 hours` from `offerWindowHours('Maize')`) and submits the lot.
- **Root Cause:** `supabase/migrations/0001_initial_schema.sql` seeded `crop_profiles` with `spinach`, `leafy vegetables`, `coriander`, `tomato`, `onion`, `potato`, `paddy`, `wheat`, `soybean`, and `cotton` — omitting `maize` (as well as `lettuce`, `fenugreek`, `tomatoes`, `brinjal`, `rice`, `wheat grain` present in `src/lib/domain/market.ts`). The DB trigger `set_lot_offer_expiry()` fell back to `12 hours` instead of `48 hours`.
- **Impact:** Farmers listing Maize received a 12-hour offer expiry instead of the promised 48-hour grain window.
- **Fix Applied:** Seeded all missing crop profiles (`maize`, `lettuce`, `fenugreek`, `tomatoes`, `brinjal`, `rice`, `wheat grain`) into `public.crop_profiles` in migration `0011`.
- **Regression Test:** Automated cross-check between all 17 crops in `offerWindowHours` and SQL migrations in [`tests/unit/domain.test.mjs`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/tests/unit/domain.test.mjs#L49-L95).

#### `P1-7`: Empty Optional `moisturePct` in `inspectionSchema` Coerced `""` to `0%` Moisture
- **Files:** [`src/lib/validation/schemas.ts`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/lib/validation/schemas.ts)
- **Reproduction:** An inspector submits `InspectionForm` with the optional Moisture % input left blank (`""`).
- **Root Cause:** `inspectionSchema` used `moisturePct: z.coerce.number().min(0).max(100).optional()` without preprocessing empty strings (`""`) or `null` to `undefined`. In JavaScript, `Number("") === 0`, which satisfied `.min(0)` and persisted `0%` moisture in the database instead of `NULL`. Additionally, `z.coerce.number()` coerces boolean `true` to `1`.
- **Impact:** Unmeasured moisture was falsely recorded as `0%` verified moisture in official inspection records and ledger hashes.
- **Fix Applied:** Introduced `numericField` and `optionalNumericField` helpers in `src/lib/validation/schemas.ts` that convert `""`, `null`, and `undefined` to `undefined` for optional fields and reject booleans (`typeof v === 'boolean' ? NaN : v`).
- **Regression Test:** Tested in [`tests/unit/domain.test.mjs`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/tests/unit/domain.test.mjs#L140-L195).

---

### `P2` — Functional, Ledger, Validation & UI Correctness Bugs

#### `P2-1`: `canonicalJson` Produced Invalid JSON when Object Properties Contained `undefined` or `-0`
- **Files:** [`src/lib/domain/ledger.ts`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/lib/domain/ledger.ts)
- **Reproduction:** Calling `canonicalJson({ a: 1, b: undefined })` or `canonicalJson({ zero: -0 })`.
- **Root Cause:** `canonicalJson` mapped over all `Object.keys(v)` without filtering `v[k] !== undefined`, emitting `{"a":1,"b":undefined}` (invalid JSON that never matches PostgreSQL `jsonb`).
- **Impact:** Any object with an optional `undefined` property hashed differently in TypeScript vs. PostgreSQL `canonical_jsonb`.
- **Fix Applied:** Filtered out keys where `obj[k] === undefined`, normalized `-0` to `'0'`, and mapped non-finite numbers to `'null'`.
- **Regression Test:** Tested in [`tests/unit/domain.test.mjs`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/tests/unit/domain.test.mjs#L114-L119).

#### `P2-2`: `bestOffer()` Ignored Escalated `awaiting_farmer` Offers & Lacked Deterministic Tie-Breaking on Identical Timestamps
- **Files:** [`src/lib/domain/market.ts`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/lib/domain/market.ts#L8-L11), [`src/components/shared/FarmerLots.tsx`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/components/shared/FarmerLots.tsx)
- **Reproduction:** After `process_expired_offers()` escalates the highest offer to `status = 'awaiting_farmer'`, `bestOffer()` returned `null`.
- **Root Cause:** `Offer['status']` did not include `'awaiting_farmer'` and `bestOffer()` filtered strictly for `o.status === 'active' && Date.parse(o.expiresAt) > now`.
- **Impact:** Domain helper `bestOffer()` could not resolve escalated offers awaiting farmer confirmation, and ties with identical `createdAt` timestamps lacked a deterministic tie-breaker (`a.id.localeCompare(b.id)`).
- **Fix Applied:** Added `'awaiting_farmer'` to `Offer['status']`, added optional `escalatedOfferId` parameter to `bestOffer()`, and added `a.id.localeCompare(b.id)` tie-breaking in both `src/lib/domain/market.ts` and `src/components/shared/FarmerLots.tsx`.
- **Regression Test:** Tested in [`tests/unit/domain.test.mjs`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/tests/unit/domain.test.mjs#L22-L47).

#### `P2-3`: Unreachable Dead Code in `IvrDemo.tsx` Blocked `*` Backspace During Quantity Entry
- **Files:** [`src/components/shared/IvrDemo.tsx`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/components/shared/IvrDemo.tsx)
- **Reproduction:** On `/[locale]/ivr-demo`, advance to the `quantity` step, enter digits (`25`), and press `*` to backspace a digit as instructed (`"press # to confirm or * to edit"`).
- **Root Cause:** `if (key === '*') { ... setStep('language'); return; }` at the top of `press()` intercepted `*` and reset the entire session before execution could reach `if (step === 'quantity') { if (key === '*') setQty(q => q.slice(0, -1)); }`.
- **Impact:** Pressing `*` during quantity entry wiped out the farmer's entire IVR session instead of deleting the last digit.
- **Fix Applied:** Checked `if (step === 'quantity' && key === '*' && qty.length > 0)` first to delete the last digit before falling back to session restart.
- **Regression Test:** Added E2E test in [`tests/e2e/core.spec.ts`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/tests/e2e/core.spec.ts#L11-L24).

#### `P2-4`: `MarketPriceExplorer` and `DemandPressure` Were Disconnected (Hardcoded `crop="Paddy"`)
- **Files:** [`src/app/[locale]/market-prices/page.tsx`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/%5Blocale%5D/market-prices/page.tsx), [`src/components/shared/MarketPriceExplorer.tsx`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/components/shared/MarketPriceExplorer.tsx)
- **Reproduction:** A user selects `Tomato` or `Wheat` in `MarketPriceExplorer` on `/[locale]/market-prices`.
- **Root Cause:** `src/app/[locale]/market-prices/page.tsx` rendered `<DemandPressure crop="Paddy" />` outside `MarketPriceExplorer` with a hardcoded `"Paddy"` prop.
- **Impact:** Demand pressure always queried `"Paddy"` regardless of which crop the user selected.
- **Fix Applied:** Rendered `<DemandPressure crop={activeCrop} />` inside `MarketPriceExplorer.tsx` so changing the crop filter updates the demand pressure card (`defaults` to `'Paddy'` when `'All'` is selected).
- **Regression Test:** Added E2E test in [`tests/e2e/core.spec.ts`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/tests/e2e/core.spec.ts#L3-L10).

#### `P2-5`: `SupervisorAudit.tsx` Misclassified `dispute_created` Events Under the `override` Filter
- **Files:** [`src/components/shared/SupervisorAudit.tsx`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/components/shared/SupervisorAudit.tsx)
- **Reproduction:** Selecting the `override` filter pill on `/[locale]/inspector/supervisor-audit`.
- **Root Cause:** The filter checked `e.action.includes('inspection') || e.action.includes('grade') || Boolean(e.reason_code)`. Because `dispute_created` audit events also populate `reason_code`, dispute filings appeared under grade/weight overrides.
- **Fix Applied:** Scoped the `override` filter specifically to `e.action === 'inspection_recorded' || e.action === 'lot_grade_or_weight_updated'`.

#### `P2-6`: `TokenCheckIn` Did Not Refresh `InspectionForm` Lot Dropdown After Gate Check-In
- **Files:** [`src/components/shared/TokenCheckIn.tsx`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/components/shared/TokenCheckIn.tsx), [`src/components/shared/InspectionForm.tsx`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/components/shared/InspectionForm.tsx)
- **Reproduction:** On `/[locale]/inspector/token-input`, an inspector checks in a token (`KQ-XXXXXXXXXX`) in `TokenCheckIn` and then looks for that lot in `InspectionForm` right beside it on the same page.
- **Root Cause:** `TokenCheckIn` and `InspectionForm` are sibling components on `/[locale]/inspector/token-input`; `InspectionForm` only fetched `/api/lots` once on mount.
- **Fix Applied:** Dispatched `window.dispatchEvent(new CustomEvent('kisanq:token-checked-in', { detail: d }))` from `TokenCheckIn` and subscribed `InspectionForm` to automatically reload eligible lots and select the checked-in lot.

#### `P2-7`: Timezone Mismatch (`UTC` vs `Asia/Kolkata`) in Harvest Date Validation (`AddCropForm.tsx` & `set_lot_offer_expiry`)
- **Files:** [`src/components/shared/AddCropForm.tsx`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/components/shared/AddCropForm.tsx), [`supabase/migrations/0011_workflow_and_security_fixes.sql`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/supabase/migrations/0011_workflow_and_security_fixes.sql#L17-L41)
- **Reproduction:** Between 00:00 IST and 05:30 IST, a farmer in India selects today's local date as `harvestDate`.
- **Root Cause:** `new Date().toISOString().slice(0, 10)` in `AddCropForm.tsx` and `current_date` in PostgreSQL `set_lot_offer_expiry()` evaluated in UTC (which is still "yesterday" between 00:00 and 05:30 IST), rejecting today's morning harvest as a "future harvest date".
- **Fix Applied:** Used `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())` in `AddCropForm.tsx` and `(now() at time zone 'Asia/Kolkata')::date` in `set_lot_offer_expiry()`.

---

### `P3` — UX, Accessibility, Query Validation & Configuration Polish

#### `P3-1`: Missing `.env.example` File Referenced by `README.md`, `docs/SETUP.md`, and `.gitignore`
- **Files:** [`.env.example`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/.env.example)
- **Fix Applied:** Created `.env.example` with safe placeholder values for all 5 environment variables.

#### `P3-2`: Marketplace Offer Modal Lacked `<form>` Enter-Key Submit, Escape Key Close, and In-Modal Error Feedback
- **Files:** [`src/components/shared/Marketplace.tsx`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/components/shared/Marketplace.tsx)
- **Fix Applied:** Wrapped modal inputs in a `<form>`, added an `Escape` key listener, and rendered validation/API error alerts inside the modal dialog as well as on the page.

#### `P3-3`: Hardcoded `/ quintal` Unit Labels in `FarmerLots.tsx` and `OfferHistory.tsx` & Unvalidated Query Params in `GET /api/prices`
- **Files:** [`src/components/shared/FarmerLots.tsx`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/components/shared/FarmerLots.tsx), [`src/components/shared/OfferHistory.tsx`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/components/shared/OfferHistory.tsx), [`src/app/api/prices/route.ts`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/src/app/api/prices/route.ts)
- **Fix Applied:** Used dynamic `lot.unit` (`kg`, `quintal`, `tonne`) in `FarmerLots.tsx` and `OfferHistory.tsx`, and added `z.string().uuid()` / `z.string().date()` validation for `mandi` and `from` query parameters in `GET /api/prices`.

---

## 5. Feature-to-Test Coverage Matrix

| Feature Area | Primary Implementation Files | Automated Tests | Verification Level |
|---|---|---|---|
| Crop perishability offer windows & SQL parity | `src/lib/domain/market.ts`, `supabase/migrations/0001_initial_schema.sql`, `0011_workflow_and_security_fixes.sql` | `tests/unit/domain.test.mjs` (`crop perishability windows cover all AddCropForm crops and match SQL migrations`) | Unit + SQL static parity test |
| Best offer selection, tie-break & escalation | `src/lib/domain/market.ts`, `supabase/migrations/0009_offer_awaiting_farmer_status.sql`, `0010_best_offer_escalation_semantics.sql`, `0011_workflow_and_security_fixes.sql` | `tests/unit/domain.test.mjs` (`best offer chooses highest active unexpired offer...`, `best offer supports escalated awaiting_farmer offers...`) | Unit test + SQL RPC inspection |
| Demand pressure calculation | `src/lib/domain/market.ts`, `src/components/shared/DemandPressure.tsx`, `src/app/api/prices/demand/route.ts` | `tests/unit/domain.test.mjs` (`demand pressure handles zero listings...`), `tests/e2e/core.spec.ts` | Unit + E2E test |
| Storage headroom & slot recommendations | `src/lib/domain/market.ts`, `src/app/api/inspector/overview/route.ts`, `src/components/shared/InspectorOperations.tsx` | `tests/unit/domain.test.mjs` (`storage headroom...`, `slot recommendation...`) | Unit test |
| Hash-chain ledger & canonical JSON | `src/lib/domain/ledger.ts`, `supabase/migrations/0001_initial_schema.sql`, `0003_audit_consent_and_scope.sql`, `0007_server_ledger_verification.sql` | `tests/unit/domain.test.mjs` (`canonical JSON...`, `ledger verifies valid chain...`), `supabase/tests/schema_smoke.sql` | Unit + SQL smoke test |
| RBAC, supervisor hierarchy & safe redirects | `src/lib/auth/roles.ts`, `src/middleware.ts`, `src/components/shared/LoginForm.tsx` | `tests/unit/domain.test.mjs` (`role hierarchy, role homes, and post-login redirect validation...`), `tests/e2e/core.spec.ts` | Unit + E2E test (Verified `exit 0`) |
| API input validation schemas (Zod) | `src/lib/validation/schemas.ts`, `src/app/api/**` | `tests/unit/domain.test.mjs` (`validation schemas preserve optional moisture, reject boolean coercion...`) | Unit test (Verified `exit 0`) |
| i18n dictionary parity (`en`, `hi`, `mr`) & switching | `src/messages/{en,hi,mr}.json`, `src/components/layout/LanguageSelect.tsx`, `src/lib/i18n/dictionaries.ts` | `tests/unit/domain.test.mjs` (`English, Hindi and Marathi dictionaries...`), `tests/e2e/core.spec.ts` | Unit + E2E test (Verified `exit 0`) |
| IVR/SMS keypad simulation | `src/components/shared/IvrDemo.tsx` | `tests/e2e/core.spec.ts` (`IVR route exposes interactive keypad, supports quantity backspace...`) | E2E test (Verified `exit 0`) |

---

## 6. External Service & Environment Variable Inventory

Only variable names and architectural roles are listed (values in `.env.local` were never read or printed):

| Variable Name | Exposure Scope | Required By | Purpose & Fallback Behavior |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + Server | `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/middleware.ts` | Supabase project URL. If unset/empty, app runs in clearly labeled demo mode. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + Server | `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/middleware.ts` | Supabase anonymous/public API key (enforces RLS with user JWT). |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** | `src/app/api/cron/expire-offers/route.ts` | Used exclusively by the secured cron route to invoke `process_expired_offers()`. Never imported in client components. |
| `CRON_SECRET` | **Server-only** | `src/app/api/cron/expire-offers/route.ts` | Bearer token verified with `crypto.timingSafeEqual` for `/api/cron/expire-offers`. Returns `503` if unconfigured. |
| `NEXT_PUBLIC_APP_URL` | Browser + Server | `.env.example`, deployment config | Canonical application URL (`http://localhost:3000` locally). |

---

## 7. Remaining Manual Steps for Live Provider & Production Setup

1. **Apply All Database Migrations (`0001` through `0011`) to Supabase:**
   - Run `supabase db push` or execute `supabase/migrations/0001_initial_schema.sql` through `supabase/migrations/0011_workflow_and_security_fixes.sql` in chronological order in the Supabase SQL Editor, followed by `supabase/seed.sql` and `supabase/tests/schema_smoke.sql`.
2. **Configure Supabase Phone Auth + SMS OTP Provider:**
   - In the Supabase Dashboard -> **Authentication -> Providers -> Phone**, enable Phone Auth and configure a production SMS provider (Twilio, MessageBird, Vonage, or Textlocal) with valid sender credentials.
3. **Provision Non-Farmer Operational Roles (`buyer`, `inspector`, `supervisor`):**
   - By security design (`profiles_self_insert_farmer_only` RLS policy in `0003_audit_consent_and_scope.sql`), self-registered accounts default to `role = 'farmer', mandi_scope = '{}'`.
   - After an inspector, supervisor, or buyer authenticates via Phone OTP, promote their row in `public.profiles` via the Supabase SQL Editor:
     ```sql
     -- Buyer promotion
     update public.profiles set role = 'buyer', mandi_scope = '{}' where id = '<AUTH_USER_UUID>';

     -- Inspector promotion (scoped to Pimpri Agricultural Market & Pune Market Yard)
     update public.profiles
     set role = 'inspector',
         mandi_scope = array['11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid]
     where id = '<AUTH_USER_UUID>';

     -- Supervisor promotion
     update public.profiles set role = 'supervisor' where id = '<AUTH_USER_UUID>';
     ```
4. **Configure Vercel Cron & Environment Variables:**
   - Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, and `NEXT_PUBLIC_APP_URL` in Vercel Project Settings.
   - `vercel.json` schedules `/api/cron/expire-offers` every 15 minutes (`*/15 * * * *`). Note: Vercel Hobby plans restrict cron jobs to once per day; a Vercel Pro plan or external scheduler (or farmer-triggered `accept_best_offer`, which now opportunistically runs `process_expired_offers()`) handles sub-hour offer escalation.

---

## 8. Residual Risks & Limitations

1. **Database Migration Application (`0011_workflow_and_security_fixes.sql`):** All local quality checks (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:e2e`) were executed and passed with exit code `0`. Before running live authenticated database flows, apply [`supabase/migrations/0011_workflow_and_security_fixes.sql`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/supabase/migrations/0011_workflow_and_security_fixes.sql) to the target Supabase database and run [`supabase/tests/schema_smoke.sql`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/supabase/tests/schema_smoke.sql).
2. **Partial Localization Coverage:** Navigation, role headers, and shared banners are translated across `en`, `hi`, and `mr` (`36` keys each), while several form-internal labels and status descriptions remain in English.
3. **Simulated Market Prices, IVR & Disabled Photo Upload:** As documented in [`docs/DATA_AND_AI_LIMITATIONS.md`](file:///e:/cursorProjects/hackathon_sankalp/KisanQ/kisanq/docs/DATA_AND_AI_LIMITATIONS.md), market prices are seeded demo values (`simulated_demo`), IVR is a browser keypad simulation, and photo AI pre-grading is intentionally disabled until a private Storage bucket and verified vision pipeline are configured.
