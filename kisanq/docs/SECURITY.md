# Security notes

- Role selection is UI context only; API handlers query the authenticated profile and reject mismatches. Middleware checks role-scoped pages when Supabase is configured.
- RLS is enabled on core tables. Farmers can create lots only for themselves; buyer offers are tied to the authenticated buyer; inspector and supervisor access is role/scope checked.
- Role, consent audit fields and inspector scope are protected from ordinary profile updates. Consent is recorded through a narrow authenticated RPC.
- Slot reservations lock the slot and lot inside a database transaction. Best-offer acceptance locks the lot and offer, then closes competing active offers.
- Audit events have no ordinary client write policies; privileged append function calls are serialized and the table rejects update/delete.
- Service role credentials are used only in the expiry cron route and are never prefixed with `NEXT_PUBLIC_`.
- OTPs, access tokens, raw photos and full phone numbers are not included in audit payloads.
- Photo upload is disabled until storage policies and content verification are implemented.

## Important review items before production

1. Run Supabase SQL/RLS integration tests using separate Farmer, Buyer, Inspector, Supervisor and anonymous sessions.
2. Review and tighten every RLS policy for the deployment's exact mandi assignment model. In particular, confirm that a NULL inspector scope denies operational access; only an explicitly provisioned supervisor should have cross-mandi access.
3. Add provider-side OTP rate limits and monitor abuse/error rates.
4. Add a formal retention/deletion policy for profile, dispute and operational data.
5. Add request rate limiting and abuse controls for public/anonymous entry points if enabled.
6. Verify canonical JSON equivalence between PostgreSQL and Node on representative Unicode, numeric, array and nested-object payloads before production ledger sign-off.
