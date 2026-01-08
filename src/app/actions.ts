'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

// 1. 建立新旅程
export async function createTrip(tripName: string, memberNames: string[]) {
  const trip = await prisma.trip.create({
    data: {
      name: tripName,
      members: {
        create: memberNames.map(name => ({ name }))
      }
    },
    include: { members: true }
  })
  return trip
}

// 2. 獲取旅程資料
export async function getTripData(tripId: string) {
  return await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      members: true,
      expenses: {
        include: {
          payer: true,
          participants: { include: { member: true } }
        },
        orderBy: { date: 'desc' }
      }
    }
  })
}

// 3. 新增一條數
export async function addExpense(data: {
  title: string
  amount: number
  payerId: string
  tripId: string
  date: string
  participantIds: string[]
  currency?: string
  foreignAmount?: number
  note?: string
  category?: string
}) {
  await prisma.expense.create({
    data: {
      title: data.title,
      amount: data.amount,
      payerId: data.payerId,
      tripId: data.tripId,
      date: new Date(data.date),
      currency: data.currency,
      foreignAmount: data.foreignAmount,
      note: data.note,
      category: data.category,
      participants: {
        create: data.participantIds.map(id => ({ memberId: id }))
      }
    }
  })
  revalidatePath('/expenses')
}

// 4. 刪除一條數
export async function deleteExpense(expenseId: string) {
  await prisma.expense.delete({ where: { id: expenseId } })
  revalidatePath('/expenses')
}
