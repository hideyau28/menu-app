# 旅程記帳 (menu-app)

Group travel expense tracker and bill splitter. No login: a trip is shared via an 8-character trip code. Cantonese UI.
Next.js 16 App Router + Server Actions + Postgres (Neon), deployed on Vercel.

## Commands

- `npm run dev` — local dev (needs `DATABASE_URL` in `.env`)
- `npm test` — Vitest (only `src/**/*.test.ts`, node environment)
- `npx tsc --noEmit` — typecheck (no package.json script)
- `npm run lint` — ESLint
- Apply schema to an empty DB: `DATABASE_URL=... ./scripts/apply-schema.sh`

## 🔴 Money (do not touch without the user's explicit approval)

- DB stores integer cents (`*_cents`); `Math.round(x * 100)` in `actions.ts` is the only conversion point. Do not switch to floats or change rounding.
- Balances and settlement suggestions live in the `balances` / `settlements` useMemos in `expenses/page.tsx`:
  equal share = `amountHKD / participants.length`, ±0.01 counts as settled. Do not change, "simplify", or move this logic into components.
- Each `participants` item is either a `string` (equal split) or `{ id, customAmount }` (custom). In the DB, `amount_cents IS NULL` means equal split. Keep both forms.
- "Paid" checkmarks are keyed by `${from}→${to}@${amount.toFixed(1)}`. Changing rounding or display format silently drops checkmarks users already ticked.
- `toFixed(1)` is display-only; never compute with its result.

## 🔴 Schema

- `db/schema.sql` is **incomplete**: `original_currency`, `original_amount_cents` (001) and `amount_cents` (002) only exist in migrations. Always read `db/migrations/` alongside it.
- No migration runner. A new migration must also be added to `scripts/apply-schema.sh`, be idempotent (`IF NOT EXISTS`), and never edit old migrations.
- Production schema changes and `migrate-from-zeabur.sh` require the user's explicit approval before running.
- Frontend types are inferred from `getTripByCode`'s return value (`expenses/types.ts`); changing its SELECT changes the UI types.

## 🔴 Permissions / security

- No accounts: **the trip code is the only credential** — anyone with it can read and write the whole trip. Codes use `crypto.randomInt`; do not switch to `Math.random` or shorten them.
- Every mutation must look up the trip by code, then verify the expense/members belong to that trip (blocks cross-trip id injection). Copy this pattern in new actions.
- Validate all input with Zod at the action entry (`parseOrThrow` in `lib/validation.ts`).
- `enforceRateLimit` is in-memory, so each Vercel instance counts separately — a speed bump, not real protection.
- SQL uses `$1` parameters only; never build query strings.

## 🔴 Env

- `DATABASE_URL`, `DATABASE_SSL` (Neon needs `require`; unset means no TLS), `DB_POOL_MAX` (set to `1` on Vercel; defaults to 10, which exhausts serverless connections), `NEXT_PUBLIC_SITE_URL`.
- The `NEXT_PUBLIC_SITE_URL` fallback in `layout.tsx` is `menu-app.vercel.app`, **not** the real production URL; it must be set on Vercel or OG/share links break.
- Do not read or print `.env*`; Vercel env changes need user approval.
- `Dockerfile` and Zeabur files are pre-migration leftovers, not the current deployment.

## 🟡 `expenses/page.tsx` (~1800 lines)

- One client component holds the whole ledger page: state, forms, exchange-rate fetch, balance math. **Do not rewrite or auto-refactor the file.**
- For UI work, extract presentational components into `expenses/components/`; pass values in via props and do no money math inside them.
- Commit money-logic changes separately from UI changes.
- localStorage keys in use (renaming loses user data): `tripUtility_recentTrips`, `tripUtility_exchangeRates`, `tripUtility_paidSettlements_<code>`.
- Rates come from `api.exchangerate-api.com` (client fetch, can fail); keep the manual exchange-rate fallback.

## Copy

- UI text in natural Hong Kong Cantonese; avoid Mainland phrasing and stiff formal tone. Strings live in `contexts/LanguageContext.tsx`; add both languages together.

## ✅ Done means

`npm test`, `npx tsc --noEmit` and `npm run lint` all pass. If any fails, the task is not done — report the output; do not skip.
