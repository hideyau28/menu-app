import type { getTripByCode } from "./actions";

// 由 server action 嘅回傳型別推導出 trip / expense 型別（單一真相來源）
export type TripData = Awaited<ReturnType<typeof getTripByCode>>;
export type ExpenseItem = NonNullable<TripData>["expenses"][number];
export type Member = NonNullable<TripData>["members"][number];

// Optimistic UI：即時反映新增/改/刪，唔等 server round-trip。
// 注意：呢度只係將「已經算好嘅值」重新排列顯示，唔做任何金額計算。
export type OptimisticAction =
  | { type: "add"; expense: ExpenseItem }
  | { type: "update"; expense: ExpenseItem }
  | { type: "delete"; id: string };

export function applyExpenseOptimistic(
  state: ExpenseItem[],
  action: OptimisticAction,
): ExpenseItem[] {
  switch (action.type) {
    case "add":
      return [action.expense, ...state];
    case "update":
      return state.map((e) => (e.id === action.expense.id ? action.expense : e));
    case "delete":
      return state.filter((e) => e.id !== action.id);
  }
}
