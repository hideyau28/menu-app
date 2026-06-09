import { describe, it, expect } from "vitest";
import {
  createTripSchema,
  addExpenseSchema,
  updateExpenseSchema,
  renameTripSchema,
  tripCodeSchema,
  parseOrThrow,
  MAX_AMOUNT,
} from "@/lib/validation";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

function validExpense(overrides: Record<string, unknown> = {}) {
  return {
    code: "ABCD2345",
    title: "餐飲",
    category: "dining",
    note: "lunch",
    date: "2026-06-09",
    payerId: UUID_A,
    participantIds: [UUID_A, UUID_B],
    amountHKD: 100,
    originalCurrency: "JPY",
    originalAmount: 2000,
    ...overrides,
  };
}

describe("createTripSchema", () => {
  it("accepts a valid trip", () => {
    const r = createTripSchema.safeParse({ name: "東京之旅", memberNames: ["阿明", "Alex"] });
    expect(r.success).toBe(true);
  });

  it("rejects fewer than 2 members", () => {
    const r = createTripSchema.safeParse({ name: "Trip", memberNames: ["阿明"] });
    expect(r.success).toBe(false);
  });

  it("rejects an empty trip name", () => {
    expect(createTripSchema.safeParse({ name: "  ", memberNames: ["a", "b"] }).success).toBe(false);
  });

  it("rejects a trip name over 50 chars", () => {
    expect(
      createTripSchema.safeParse({ name: "x".repeat(51), memberNames: ["a", "b"] }).success,
    ).toBe(false);
  });

  it("rejects a member name over 20 chars", () => {
    expect(
      createTripSchema.safeParse({ name: "Trip", memberNames: ["a", "y".repeat(21)] }).success,
    ).toBe(false);
  });
});

describe("addExpenseSchema", () => {
  it("accepts a valid expense", () => {
    expect(addExpenseSchema.safeParse(validExpense()).success).toBe(true);
  });

  it("accepts an expense with no optional fields", () => {
    const r = addExpenseSchema.safeParse({
      code: "ABCD2345",
      title: "其他",
      date: "2026-06-09",
      payerId: UUID_A,
      participantIds: [UUID_A],
      amountHKD: 50,
    });
    expect(r.success).toBe(true);
  });

  it("rejects a non-positive amount", () => {
    expect(addExpenseSchema.safeParse(validExpense({ amountHKD: 0 })).success).toBe(false);
    expect(addExpenseSchema.safeParse(validExpense({ amountHKD: -5 })).success).toBe(false);
  });

  it("rejects an amount above MAX_AMOUNT (int4 overflow guard)", () => {
    expect(addExpenseSchema.safeParse(validExpense({ amountHKD: MAX_AMOUNT + 1 })).success).toBe(false);
  });

  it("accepts an amount exactly at MAX_AMOUNT", () => {
    expect(addExpenseSchema.safeParse(validExpense({ amountHKD: MAX_AMOUNT })).success).toBe(true);
  });

  it("rejects a non-finite amount", () => {
    expect(addExpenseSchema.safeParse(validExpense({ amountHKD: Infinity })).success).toBe(false);
    expect(addExpenseSchema.safeParse(validExpense({ amountHKD: NaN })).success).toBe(false);
  });

  it("rejects an empty participant list", () => {
    expect(addExpenseSchema.safeParse(validExpense({ participantIds: [] })).success).toBe(false);
  });

  it("rejects a non-uuid payer / participant", () => {
    expect(addExpenseSchema.safeParse(validExpense({ payerId: "not-a-uuid" })).success).toBe(false);
    expect(addExpenseSchema.safeParse(validExpense({ participantIds: ["nope"] })).success).toBe(false);
  });

  it("rejects an invalid date", () => {
    expect(addExpenseSchema.safeParse(validExpense({ date: "2026-13-40" })).success).toBe(false);
    expect(addExpenseSchema.safeParse(validExpense({ date: "09/06/2026" })).success).toBe(false);
  });

  it("rejects a currency code with digits/symbols", () => {
    expect(addExpenseSchema.safeParse(validExpense({ originalCurrency: "JP1" })).success).toBe(false);
  });

  it("accepts valid custom splits and rejects negative ones", () => {
    expect(
      addExpenseSchema.safeParse(validExpense({ customSplits: { [UUID_A]: "60", [UUID_B]: "40" } })).success,
    ).toBe(true);
    expect(
      addExpenseSchema.safeParse(validExpense({ customSplits: { [UUID_A]: "-1" } })).success,
    ).toBe(false);
  });
});

describe("updateExpenseSchema", () => {
  it("requires a uuid expenseId", () => {
    expect(updateExpenseSchema.safeParse(validExpense()).success).toBe(false); // missing expenseId
    expect(
      updateExpenseSchema.safeParse({ ...validExpense(), expenseId: UUID_A }).success,
    ).toBe(true);
  });
});

describe("renameTripSchema", () => {
  it("validates code + new name", () => {
    expect(renameTripSchema.safeParse({ code: "ABCD2345", newName: "新名" }).success).toBe(true);
    expect(renameTripSchema.safeParse({ code: "ABCD2345", newName: "" }).success).toBe(false);
  });
});

describe("tripCodeSchema", () => {
  it("rejects empty and over-long codes", () => {
    expect(tripCodeSchema.safeParse("").success).toBe(false);
    expect(tripCodeSchema.safeParse("x".repeat(17)).success).toBe(false);
  });
});

describe("parseOrThrow", () => {
  it("returns parsed data on success", () => {
    const r = parseOrThrow(renameTripSchema, { code: "ABCD2345", newName: "ok" });
    expect(r.newName).toBe("ok");
  });

  it("throws a friendly message on failure", () => {
    expect(() => parseOrThrow(renameTripSchema, { code: "ABCD2345", newName: "" })).toThrow(
      "請輸入旅程名稱",
    );
  });
});
