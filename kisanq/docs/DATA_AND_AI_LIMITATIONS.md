# Data and AI limitations

## Market prices

All built-in market price cards and charts use illustrative demonstration values and are labeled `simulated_demo` in the UI/seed path. No live APMC feed is configured and no price should be used for a trade decision. A future verified feed must store mandi, observation date, minimum/maximum/modal price, unit, source, source URL/note, and provenance. Do not relabel simulated observations as verified.

## Pre-grade image estimate

Photo upload is disabled in the current UI. There is no trained crop-grade model or vision provider configured, and no grade/confidence is invented. Before enabling this feature, implement a reproducible image-processing pipeline or configure a server-side vision model, store method/version and measurable metadata, show the required physical-verification disclaimer, and validate the heuristic/model on labeled local crop images. Inspector physical grading remains authoritative.

## Inspector recommendations

Slot-distribution and capacity recommendations use deterministic arithmetic/rule-based baselines (`slotRecommendation` and `calculateStorageHeadroom`), not trained AI predictions. When an authenticated inspector or supervisor is connected to Supabase, `GET /api/inspector/overview` aggregates real mandi-scoped `slots`, `mandis` storage capacity, and `crop_lots` yard loads (`reserved`, `checked_in`, `inspected`). Sample rows are displayed only when Supabase is unconfigured or the user is viewing in demo mode, and the UI explicitly labels live vs. demonstration status. Missing storage capacity (`storage_capacity_quintals IS NULL`) remains unavailable (`N/A`) rather than guessed.

## Ledger

The ledger is a database-backed hash-chained audit log, not a blockchain network and not distributed consensus. It supports tamper evidence and server-side chain verification; production governance could consider Hyperledger Fabric later, as a separate project decision.

## IVR/SMS

The keypad journey is a simulation only. No call, OTP or SMS is placed. A real telephony provider and authenticated webhook/security design are required for production IVR.
