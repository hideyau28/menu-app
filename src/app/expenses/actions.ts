"use server";

import { query, getClient } from "@/lib/db";
import { revalidatePath } from "next/cache";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createTrip(name: string, memberNames: string[]) {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    let code = generateCode();
    let tripId: string;

    while (true) {
      try {
        const tripResult = await client.query<{ id: string }>(
          "INSERT INTO trips (name, trip_code) VALUES ($1, $2) RETURNING id",
          [name, code]
        );
        tripId = tripResult.rows[0].id;
        break;
      } catch (e: any) {
        // unique violation
        if (e?.code === "23505") {
          code = generateCode();
        } else {
          throw e;
        }
      }
    }

    for (const memberName of memberNames) {
      await client.query(
        "INSERT INTO members (trip_id, name) VALUES ($1, $2)",
        [tripId, memberName]
      );
    }

    await client.query("COMMIT");

    // Wait 1 second for DB sync
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Double-check verification: ensure trip was actually written
    const verifyResult = await client.query(
      "SELECT id, name, trip_code FROM trips WHERE trip_code = $1",
      [code]
    );

    if (verifyResult.rows.length === 0) {
      throw new Error("DB Write Failed: Trip not found after commit");
    }

    // Revalidate the expenses page
    revalidatePath('/expenses');

    return { code };
  } catch (e: any) {
    await client.query("ROLLBACK");
    const errorMsg = e?.message || "Unknown error during trip creation";
    throw new Error(`Failed to create trip: ${errorMsg}`);
  } finally {
    client.release();
  }
}

export async function getTripByCode(code: string) {
  const tripResult = await query(
    "SELECT id, name, trip_code FROM trips WHERE trip_code = $1",
    [code]
  );

  if (tripResult.rows.length === 0) return null;

  const trip = tripResult.rows[0] as { id: string; name: string; trip_code: string };

  const membersResult = await query(
    "SELECT id, name FROM members WHERE trip_id = $1 ORDER BY created_at",
    [trip.id]
  );

  const members = (membersResult.rows as Array<{ id: string; name: string }>).map(
    (m: { id: string; name: string }) => ({ id: m.id, name: m.name })
  );

  const expensesResult = await query(
    `SELECT
      e.id, e.title, e.category, e.note, e.date,
      e.payer_member_id, e.total_amount_hkd_cents,
      e.original_currency, e.original_amount_cents,
      m.name as payer_name
    FROM expenses e
    JOIN members m ON e.payer_member_id = m.id
    WHERE e.trip_id = $1
    ORDER BY e.date DESC, e.created_at DESC`,
    [trip.id]
  );

  const expenses: Array<{
    id: string;
    title: string;
    category?: string | null;
    note?: string | null;
    date: string;
    payerId: string;
    payerName: string;
    amountHKD: number;
    participants: Array<string | { id: string; customAmount?: number }>;
    originalCurrency?: string | null;
    originalAmount?: number | null;
  }> = [];

  for (const expRow of expensesResult.rows as Array<{
    id: string;
    title: string;
    category: string | null;
    note: string | null;
    date: Date;
    payer_member_id: string;
    total_amount_hkd_cents: number;
    original_currency: string | null;
    original_amount_cents: number | null;
    payer_name: string;
  }>) {
    const participantsResult = await query(
      "SELECT member_id, amount_cents FROM expense_participants WHERE expense_id = $1",
      [expRow.id]
    );

    const participants = (participantsResult.rows as Array<{ member_id: string; amount_cents: number | null }>).map(
      (p: { member_id: string; amount_cents: number | null }) => {
        // If amount_cents is null, return just the ID (equal split)
        // Otherwise, return object with customAmount
        if (p.amount_cents === null) {
          return p.member_id;
        }
        return {
          id: p.member_id,
          customAmount: p.amount_cents / 100,
        };
      }
    );

    expenses.push({
      id: expRow.id,
      title: expRow.title,
      category: expRow.category,
      note: expRow.note,
      date: expRow.date.toISOString().slice(0, 10),
      payerId: expRow.payer_member_id,
      payerName: expRow.payer_name,
      amountHKD: expRow.total_amount_hkd_cents / 100,
      participants: participants,
      originalCurrency: expRow.original_currency,
      originalAmount: expRow.original_amount_cents ? expRow.original_amount_cents / 100 : null,
    });
  }

  return {
    id: trip.id,
    name: trip.name,
    code: trip.trip_code,
    members,
    expenses,
  };
}

export async function addExpense(payload: {
  code: string;
  title: string;
  category?: string;
  note?: string;
  date: string;
  payerId: string;
  participantIds: string[];
  amountHKD: number;
  originalCurrency?: string;
  originalAmount?: number;
  customSplits?: Record<string, string>;
}) {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const tripResult = await client.query<{ id: string }>(
      "SELECT id FROM trips WHERE trip_code = $1",
      [payload.code]
    );

    if (tripResult.rows.length === 0) throw new Error("Trip not found");

    const tripId = tripResult.rows[0].id;
    const cents = Math.round(payload.amountHKD * 100);
    const originalCents = payload.originalAmount
      ? Math.round(payload.originalAmount * 100)
      : cents;
    const currency = payload.originalCurrency || 'HKD';

    const expenseResult = await client.query<{ id: string }>(
      `INSERT INTO expenses
        (trip_id, title, category, note, payer_member_id, total_amount_hkd_cents, date, original_currency, original_amount_cents)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        tripId,
        payload.title,
        payload.category ?? null,
        payload.note ?? null,
        payload.payerId,
        cents,
        payload.date,
        currency,
        originalCents,
      ]
    );

    const expenseId = expenseResult.rows[0].id;

    for (const memberId of payload.participantIds) {
      const customAmount = payload.customSplits?.[memberId];
      const amountCents = customAmount
        ? Math.round(parseFloat(customAmount) * 100)
        : null; // null means equal split

      await client.query(
        "INSERT INTO expense_participants (expense_id, member_id, amount_cents) VALUES ($1, $2, $3)",
        [expenseId, memberId, amountCents]
      );
    }

    await client.query("COMMIT");
    revalidatePath('/expenses');
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteExpense(code: string, expenseId: string) {
  const tripResult = await query(
    "SELECT id FROM trips WHERE trip_code = $1",
    [code]
  );

  if (tripResult.rows.length === 0) throw new Error("Trip not found");

  const tripId = (tripResult.rows[0] as { id: string }).id;

  await query("DELETE FROM expenses WHERE id = $1 AND trip_id = $2", [
    expenseId,
    tripId,
  ]);
  revalidatePath('/expenses');
}
