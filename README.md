# 旅程記帳 (menu-app)

Next.js 多人旅行記帳／分帳。

**Live:** https://menu-app-weld-eta.vercel.app  
Stack: **Vercel + Neon Postgres** (migrated from Zeabur).

## Local

```bash
cp .env.example .env   # 填 DATABASE_URL 等
npm install
npm run dev
```

## Env

見 [`.env.example`](.env.example)：`DATABASE_URL`、`DATABASE_SSL=require`、`DB_POOL_MAX=1`、`NEXT_PUBLIC_SITE_URL`。

## DB migrate

- 空庫套 schema：`DATABASE_URL=... ./scripts/apply-schema.sh`
- 由 Zeabur 搬資料：`ZEABUR_DATABASE_URL=... DATABASE_URL=... ./scripts/migrate-from-zeabur.sh`

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
