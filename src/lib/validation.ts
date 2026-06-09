// 系統邊界輸入驗證 (Zod)
// 注意：呢度只做「驗證 / 邊界檢查」，唔做任何金額計算或 rounding。
// 所有錢數運算邏輯仍然喺 actions.ts / page.tsx 入面，原封不動。
import { z } from "zod";

const UUID = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "ID 格式無效",
  );

// Postgres `integer` (int4) 上限 = 2,147,483,647 cents ≈ 21,474,836 單位。
// 為咗避免 `amount * 100` 溢出令 INSERT 出錯，喺邊界封一個安全上限。
// （呢個係輸入驗證，唔影響任何 rounding / 計數邏輯。）
export const MAX_AMOUNT = 20_000_000;

const positiveAmount = z
  .number()
  .refine((n) => Number.isFinite(n), "金額無效")
  .refine((n) => n > 0, "金額要大於 0")
  .refine((n) => n <= MAX_AMOUNT, "金額過大");

const currencyCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{1,8}$/, "幣種代碼無效");

// custom split 喺表單係以 string 形式儲存；只驗證可解析為非負數，唔做運算。
const splitValue = z.string().refine((v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0;
}, "分擔金額無效");

export const tripCodeSchema = z.string().trim().min(1, "請輸入旅程碼").max(16, "旅程碼無效");

export const createTripSchema = z.object({
  name: z.string().trim().min(1, "請輸入旅程名稱").max(50, "旅程名稱最多 50 字"),
  memberNames: z
    .array(z.string().trim().min(1).max(20, "成員名稱最多 20 字"))
    .min(2, "最少要 2 位成員")
    .max(50, "成員數目過多"),
});

const expenseFields = {
  code: tripCodeSchema,
  title: z.string().trim().min(1).max(50, "標題過長"),
  category: z.string().trim().max(20).optional(),
  note: z.string().trim().max(1000, "備註過長").optional(),
  date: z
    .string()
    .refine(
      (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)),
      "日期無效",
    ),
  payerId: UUID,
  participantIds: z.array(UUID).min(1, "最少揀一位分擔者").max(50),
  amountHKD: positiveAmount,
  originalCurrency: currencyCode.optional(),
  originalAmount: positiveAmount.optional(),
  customSplits: z.record(z.string(), splitValue).optional(),
};

export const addExpenseSchema = z.object(expenseFields);

export const updateExpenseSchema = z.object({
  ...expenseFields,
  expenseId: UUID,
});

export const renameTripSchema = z.object({
  code: tripCodeSchema,
  newName: z.string().trim().min(1, "請輸入旅程名稱").max(50, "旅程名稱最多 50 字"),
});

/**
 * 將任意 Zod schema 套用喺輸入上，失敗時 throw 一個用戶睇得明嘅 Error
 * （client 會將 error.message 直接顯示喺 toast）。
 */
export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? "輸入資料無效";
    throw new Error(msg);
  }
  return result.data;
}
