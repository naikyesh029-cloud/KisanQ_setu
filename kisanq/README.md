# KisanQ

KisanQ is a role-aware agricultural mandi marketplace and operations platform for farmers, buyers, and mandi inspectors. It is built with Next.js App Router, TypeScript strict mode, Tailwind CSS, Supabase PostgreSQL/Auth/Storage integration points, Zod validation, and Recharts.

> **Important:** Until Supabase is configured, pages that use illustrative data are explicitly marked as demo/simulated. The application does not silently persist to a local mock database, claim that OTP was sent, or present simulated market values as live APMC prices.

## Quick start

1. Use Node.js 22 or a compatible Node.js version supported by the selected Next.js release.
2. Copy `.env.example` to `.env.local`.
3. Install dependencies with `npm install`.
4. Run `npm run dev` and open `http://localhost:3000`.
5. For real authentication and persistence, configure Supabase and follow [`docs/SETUP.md`](docs/SETUP.md).

## Main routes

- `/en/login` — phone OTP login and role mismatch protection
- `/en/farmer/lots/new` — farmer crop registration form
- `/en/farmer/lots` — farmer's lots entry point
- `/en/buyer/marketplace` — searchable/filterable marketplace and offer form
- `/en/buyer/offers` — buyer offer history entry point
- `/en/inspector/dashboard` — explainable capacity recommendations (seed/demo values labeled)
- `/en/inspector/inspections` — reason-coded physical grading and weigh-in
- `/en/inspector/supervisor-audit` — read-only audit view
- `/en/inspector/ledger` — SHA-256 hash-chain verification
- `/en/inspector/disputes` — scoped dispute desk
- `/en/market-prices` — market ticker and price charts, visibly simulated until a verified source is connected
- `/en/ivr-demo` — interactive phone keypad simulation

English, Hindi, and Marathi route prefixes are supported: `/en`, `/hi`, `/mr`.

## Quality commands

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:e2e`
- `npm run build`

See [`docs/REQUIREMENTS_CHECKLIST.md`](docs/REQUIREMENTS_CHECKLIST.md) for verified, unverified, and blocked scope.
