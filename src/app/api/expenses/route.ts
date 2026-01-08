import { NextResponse } from "next/server";
import prisma from "@/lib/prisma"; // 引用我們設定好的 Prisma Client

export async function GET() {
  try {
    // 1. 向資料庫查詢所有 Expense 記錄，並按時間倒序排列
    const expenses = await prisma.expense.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 2. 回傳真實的資料庫數據
    return NextResponse.json(expenses);
  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch data from database" },
      { status: 500 }
    );
  }
}
