"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createTrip, getTripByCode, addExpense, deleteExpense } from "./actions";

type TripData = Awaited<ReturnType<typeof getTripByCode>>;

const CATEGORIES = [
  { id: "dining", label: "餐飲", icon: "🍽️" },
  { id: "transport", label: "交通", icon: "🚗" },
  { id: "hotel", label: "住宿", icon: "🏨" },
  { id: "shopping", label: "購物", icon: "🛍️" },
  { id: "activity", label: "活動", icon: "🎡" },
  { id: "other", label: "其他", icon: "📝" },
];

function ExpensesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const [data, setData] = useState<TripData | null>(null);
  const [loading, setLoading] = useState(false);

  // create trip
  const [tripName, setTripName] = useState("");
  const [memberNames, setMemberNames] = useState<string[]>(["", ""]);

  // add expense
  const [category, setCategory] = useState("dining");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // auto redirect to last trip
  useEffect(() => {
    if (!code) {
      const last = localStorage.getItem("last_trip_code");
      if (last) router.replace(`/expenses?code=${last}`);
    }
  }, [code, router]);

  // load trip
  useEffect(() => {
    if (!code) return;

    let cancelled = false;
    setLoading(true);

    getTripByCode(code)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        if (res) {
          setPayerId(res.members[0]?.id ?? "");
          setParticipantIds(res.members.map((m) => m.id));
        }
      })
      .catch(() => setData(null))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [code]);

  const reloadTrip = async () => {
    if (!code) return;
    const res = await getTripByCode(code);
    setData(res);
  };

  const handleCreateTrip = async () => {
    const members = memberNames.map((n) => n.trim()).filter(Boolean);
    if (!tripName || members.length < 2) {
      showToast("請輸入旅程名稱及最少 2 位成員", "error");
      return;
    }

    const res = await createTrip(tripName, members);
    localStorage.setItem("last_trip_code", res.code);
    router.replace(`/expenses?code=${res.code}`);
  };

  const handleAddExpense = async () => {
    if (!data) return;
    if (!amount || !payerId || participantIds.length === 0) {
      showToast("資料不完整", "error");
      return;
    }

    await addExpense({
      code: data.code,
      title: CATEGORIES.find((c) => c.id === category)?.label ?? "其他",
      category,
      note: note || undefined,
      date,
      payerId,
      participantIds,
      amountHKD: Number(amount),
    });

    setAmount("");
    setNote("");
    await reloadTrip();
    showToast("已新增");
  };

  const handleDelete = async (expenseId: string) => {
    if (!data) return;
    await deleteExpense(data.code, expenseId);
    await reloadTrip();
    showToast("已刪除");
  };

  const balances = useMemo(() => {
    if (!data) return {};
    const bal: Record<string, number> = {};
    data.members.forEach((m) => (bal[m.id] = 0));

    data.expenses.forEach((e) => {
      const share = e.amountHKD / e.participants.length;
      bal[e.payerId] += e.amountHKD;
      e.participants.forEach((pid) => (bal[pid] -= share));
    });

    return bal;
  }, [data]);

  if (!code) {
    return (
      <div className="min-h-screen bg-black p-4 text-white">
        <h1 className="text-3xl font-bold mb-6">建立新旅程</h1>

        <input
          className="w-full p-4 bg-[#1c1c1e] rounded-xl mb-4"
          placeholder="旅程名稱"
          value={tripName}
          onChange={(e) => setTripName(e.target.value)}
        />

        {memberNames.map((n, i) => (
          <input
            key={i}
            className="w-full p-4 bg-[#1c1c1e] rounded-xl mb-2"
            placeholder={`成員 ${i + 1}`}
            value={n}
            onChange={(e) => {
              const next = [...memberNames];
              next[i] = e.target.value;
              setMemberNames(next);
            }}
          />
        ))}

        <button onClick={handleCreateTrip} className="w-full py-3 bg-blue-600 rounded-xl">
          開始
        </button>

        {toast && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 px-4 py-2 rounded-xl">{toast.msg}</div>}
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        {loading ? "載入中..." : "找不到旅程"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 text-white">
      <h1 className="text-2xl font-bold mb-4">{data.name}</h1>

      <div className="mb-6 p-4 bg-blue-700 rounded-xl">
        總開支 HKD {data.expenses.reduce((s, e) => s + e.amountHKD, 0).toFixed(2)}
      </div>

      <div className="space-y-2 mb-6">
        {Object.entries(balances).map(([id, bal]) => (
          <div key={id} className="flex justify-between bg-[#1c1c1e] p-3 rounded-xl">
            <span>{data.members.find((m) => m.id === id)?.name}</span>
            <span>{bal.toFixed(1)}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {data.expenses.map((e) => (
          <div key={e.id} className="flex justify-between bg-[#1c1c1e] p-3 rounded-xl">
            <span>{e.title}</span>
            <button onClick={() => handleDelete(e.id)} className="text-red-400">
              刪
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">載入中...</div>}>
      <ExpensesPageContent />
    </Suspense>
  );
}