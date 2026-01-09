"use server";

import { query, getClient } from "@/lib/db";

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
        const tripResult = await client.query(
          "INSERT INTO trips (name, trip_code) VALUES ($1, $2) RETURNING id",
          [name, code]
        );
        tripId = tripResult.rows[0].id;
        break;
      } catch (e: any) {
        if (e.code === "23505") {
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
    return { code };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function getTripByCode(code: string) {
  const tripResult = await query(
    "SELECT id, name, trip_code FROM trips WHERE trip_code = $1",
    [code]
  );

  if (tripResult.rows.length === 0) {
    return null;
  }

  const trip = tripResult.rows[0];

  const membersResult = await query(
    "SELECT id, name FROM members WHERE trip_id = $1 ORDER BY created_at",
    [trip.id]
  );

  const expensesResult = await query(
    `SELECT
      e.id, e.title, e.category, e.note, e.date,
      e.payer_member_id, e.total_amount_hkd_cents,
      m.name as payer_name
    FROM expenses e
    JOIN members m ON e.payer_member_id = m.id
    WHERE e.trip_id = $1
    ORDER BY e.date DESC, e.created_at DESC`,
    [trip.id]
  );

  const expenses = [];
  for (const exp of expensesResult.rows) {
    const participantsResult = await query(
      "SELECT member_id FROM expense_participants WHERE expense_id = $1",
      [exp.id]
    );

    expenses.push({
      id: exp.id,
      title: exp.title,
      category: exp.category,
      note: exp.note,
      date: exp.date.toISOString().slice(0, 10),
      payerId: exp.payer_member_id,
      payerName: exp.payer_name,
      amountHKD: exp.total_amount_hkd_cents / 100,
participants: participantsResult.rows.map((p: { member_id: string }) => p.member_id),
    });
  }

  return {
    id: trip.id,
    name: trip.name,
    code: trip.trip_code,
    members: membersResult.rows.map((m) => ({ id: m.id, name: m.name })),
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
}) {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const tripResult = await client.query(
      "SELECT id FROM trips WHERE trip_code = $1",
      [payload.code]
    );

    if (tripResult.rows.length === 0) {
      throw new Error("Trip not found");
    }

    const tripId = tripResult.rows[0].id;
    const cents = Math.round(payload.amountHKD * 100);

    const expenseResult = await client.query(
      `INSERT INTO expenses
        (trip_id, title, category, note, payer_member_id, total_amount_hkd_cents, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        tripId,
        payload.title,
        payload.category || null,
        payload.note || null,
        payload.payerId,
        cents,
        payload.date,
      ]
    );

    const expenseId = expenseResult.rows[0].id;

    for (const memberId of payload.participantIds) {
      await client.query(
        "INSERT INTO expense_participants (expense_id, member_id) VALUES ($1, $2)",
        [expenseId, memberId]
      );
    }

    await client.query("COMMIT");
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

  if (tripResult.rows.length === 0) {
    throw new Error("Trip not found");
  }

  await query("DELETE FROM expenses WHERE id = $1 AND trip_id = $2", [
    expenseId,
    tripResult.rows[0].id,
  ]);
}
