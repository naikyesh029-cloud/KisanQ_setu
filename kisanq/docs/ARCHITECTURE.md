# Architecture

## Runtime and boundaries

- **Next.js App Router** hosts localized pages and Route Handlers in one deployable application.
- **Presentation** lives in `src/components`; pages compose feature-level UI.
- **Domain logic** in `src/lib/domain` contains deterministic market rules and the local SHA-256 chain verifier.
- **Validation** in `src/lib/validation` uses Zod for untrusted request payloads.
- **Supabase** browser/server clients are isolated under `src/lib/supabase`. Public clients use the anon key and user session; the service-role key is only used by the secured expiry job.
- **PostgreSQL** migrations establish core entities, constraints, RLS, atomic slot reservation/token check-in, offer expiry, best-offer escalation/acceptance, inspections, and append-only audit records.
- **Translations** are in `src/messages/{en,hi,mr}.json`.

## Request path

A UI mutation submits to a Route Handler. The handler obtains the session with `auth.getUser()`, checks the profile role, validates with Zod, and then uses the user-scoped Supabase client so RLS remains active. Concurrency-sensitive operations (slot reservation, offer expiry processing, accepting the best offer, physical inspection) are database functions rather than browser-side count checks.

## Operational defaults

Offer windows are configurable in `crop_profiles`. At expiry, the highest active offer wins; ties are resolved by earliest creation timestamp and then offer UUID. The winner transitions to `awaiting_farmer`, competing active offers expire, and the farmer must explicitly confirm acceptance. Current initial defaults (3 hours for leafy greens, 8 hours for selected perishables, 48 hours for grains/oilseeds/cotton, 12 hours fallback) are operational defaults only—not scientifically validated shelf-life estimates.

## Ledger

`audit_events` is an append-only, sequence-ordered SHA-256 chain. The first previous hash is `KISANQ_LEDGER_GENESIS_V1`; the hash input is `previous_hash + canonical_json(event_payload)`, with recursive lexicographic key ordering, compact JSON serialization, and normalized numeric formatting. Database advisory locking serializes append calls, a trigger rejects update/delete, and a security-definer verification RPC validates the complete chain without returning out-of-scope event payloads. This is tamper-evident audit logging, not a distributed blockchain or consensus system.

## Demo versus production

Demo prices and operational examples are labeled as simulated/illustrative. They are not read as production facts. Supabase API handlers return clear errors when credentials or authenticated sessions are missing; there is no invisible production mock persistence.
