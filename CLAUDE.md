# 旅程記帳 (menu-app)

畀一班人去旅行一齊記數、分帳嘅 web app。冇登入，靠 8 位旅程碼共用一個帳本。廣東話 UI。
Next.js 16 App Router + Server Actions + Postgres（Neon），部署喺 Vercel。

## 指令

- `npm run dev`：本地開發（要先喺 `.env` 填好 `DATABASE_URL`）
- `npm test`：Vitest（只跑 `src/**/*.test.ts`，node 環境）
- `npx tsc --noEmit`：typecheck（package.json 冇 script）
- `npm run lint`：ESLint
- 空 DB 套 schema：`DATABASE_URL=... ./scripts/apply-schema.sh`

## 🔴 錢（未得用戶明確同意唔好掂）

- DB 用整數 cents（`*_cents`）；`actions.ts` 入面嘅 `Math.round(x * 100)` 係唯一轉換位。唔好改做 float，唔好改 rounding。
- 結餘同還款建議喺 `expenses/page.tsx` 嘅 `balances`／`settlements` useMemo：
  平分 = `amountHKD / participants.length`，±0.01 當平數。邏輯唔好改、唔好「簡化」、唔好搬去 component。
- `participants` 每項可以係 `string`（平分）或者 `{ id, customAmount }`（自訂）。DB 用 `amount_cents IS NULL` 表示平分。兩邊都要保留。
- 「已還款」剔號嘅 key 係 `${from}→${to}@${amount.toFixed(1)}`。改 rounding 或者顯示格式，用戶已經剔咗嘅會靜靜雞消失。
- `toFixed(1)` 只用嚟顯示，唔好用佢嘅結果再計數。

## 🔴 Schema

- `db/schema.sql` **唔完整**：`original_currency`、`original_amount_cents`（001）同 `amount_cents`（002）喺 migrations 先有。睇 schema 一定要連 `db/migrations/` 一齊睇。
- 冇 migration runner。加新 migration 要同時寫入 `scripts/apply-schema.sh`，要 idempotent（`IF NOT EXISTS`），而且唔好改舊 migration。
- Production DB 嘅 schema 改動、`migrate-from-zeabur.sh` 一律要用戶親手批准先跑。
- 前端型別由 `getTripByCode` 回傳值推導（`expenses/types.ts`），改 SELECT 等於改晒 UI 型別。

## 🔴 權限／安全

- 冇帳戶系統，**旅程碼就係唯一權限**：有碼就讀寫得成個 trip。旅程碼用 `crypto.randomInt` 生成，唔好換做 `Math.random`，唔好縮短長度。
- 每個 mutation 都要：先用 code 搵 trip，再 check expense／member 屬於嗰個 trip（防跨 trip 注入 id）。新 action 照抄呢個做法。
- 輸入一律喺 action 入口過 Zod（`lib/validation.ts` 嘅 `parseOrThrow`）。
- `enforceRateLimit` 用 in-memory 計數，Vercel 每個 instance 各計各，所以只係擋一下，唔係真正防護。唔好當佢係防護層。
- SQL 只可以用 `$1` 參數，唔好砌字串。

## 🔴 Env

- `DATABASE_URL`、`DATABASE_SSL`（Neon 要 `require`；未設會冇 TLS）、`DB_POOL_MAX`（Vercel 設 `1`，未設預設 10，serverless 會爆連線）、`NEXT_PUBLIC_SITE_URL`。
- `layout.tsx` 嘅 `NEXT_PUBLIC_SITE_URL` fallback 係 `menu-app.vercel.app`，**唔係**真正 production URL；Vercel 一定要設呢個值，否則 OG／分享連結會錯。
- 唔好讀、唔好印 `.env*`；改 Vercel env 要用戶批准。
- `Dockerfile`／Zeabur 相關嘢已經冇用（遷移前遺留），唔好當佢係現行部署。

## 🟡 `expenses/page.tsx`（約 1800 行）

- 成個記帳頁嘅 state、表單、匯率 fetch、結餘計算都喺呢個 client component 入面。**唔好成個檔重寫或者 auto-refactor。**
- 改 UI：抽去 `expenses/components/` 做 presentational component，數值由 props 傳入，component 入面唔好計錢。
- 錢嘅邏輯同 UI 改動要分開 commit。
- 用緊嘅 localStorage key（改名會令用戶資料消失）：`tripUtility_recentTrips`、`tripUtility_exchangeRates`、`tripUtility_paidSettlements_<code>`。
- 匯率來自 `api.exchangerate-api.com`（client fetch，可能會失敗），要保留手動輸入匯率嘅 fallback。

## 文案

- UI 用自然香港廣東話，避免大陸用語同官腔。中英文字串喺 `contexts/LanguageContext.tsx`，兩個語言都要一齊加。

## ✅ 改完必做

`npm test`、`npx tsc --noEmit`、`npm run lint` 三樣全部 pass 先算完成；有一樣 fail 就未完成，要報告 output，唔好跳過。
