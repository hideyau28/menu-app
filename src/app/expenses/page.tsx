"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createTrip, getTripByCode, addExpense, deleteExpense } from "./actions";

// 定義資料類型
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

  // State
  const [data, setData] = useState<TripData | null>(null);
  // 如果網址有 code，預設就是 loading 狀態，避免閃爍出現在「建立新旅程」畫面
  const [loading, setLoading] = useState(!!code);

  // Create Trip State
  const [tripName, setTripName] = useState("");
  const [memberNames, setMemberNames] = useState<string[]>(["", ""]);

  // Expense Input State
  const [category, setCategory] = useState("dining");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);

  // Toast Helper
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Share Link Handler
  const handleShareLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href)
        .then(() => showToast("連結已複製"))
        .catch(() => showToast("複製失敗", "error"));
    }
  };

  // --- 核心邏輯修改：移除 localStorage，改為 Server Action 直連檢查 ---

  // 1. 載入旅程 (Load Trip)
  // 當 URL 有 code 時，強制向 Server 查詢最新狀態
  useEffect(() => {
    if (!code) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;

    // 呼叫 Server Action (直接查 DB)
    getTripByCode(code)
      .then((res) => {
        if (cancelled) return;

        if (res) {
          // DB 有資料 -> 設定資料並顯示主畫面
          setData(res);
          // 預設填入第一個成員
          if (res.members.length > 0) {
            setPayerId(prev => prev || res.members[0].id);
            setParticipantIds(prev => prev.length > 0 ? prev : res.members.map((m) => m.id));
          }
        } else {
          // DB 沒資料 (Code 錯誤或被刪除) -> 清空，顯示建立畫面
          setData(null);
          showToast("找不到此旅程，請重新建立", "error");
        }
      })
      .catch(() => {
        if (!cancelled) {
            setData(null);
            showToast("連線錯誤", "error");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  // 2. 刷新數據 (Reload)
  const reloadTrip = async () => {
    if (!code) return;
    try {
      const res = await getTripByCode(code);
      if (res) setData(res);
    } catch (error) {
      console.error("Reload failed", error);
    }
  };

  // 3. 建立旅程 (Create Trip)
  // 這裡移除了 localStorage.setItem
  const handleCreateTrip = async () => {
    const members = memberNames.map((n) => n.trim()).filter(Boolean);
    if (!tripName || members.length < 2) {
      showToast("請輸入旅程名稱及最少 2 位成員", "error");
      return;
    }

    try {
      setLoading(true);
      const res = await createTrip(tripName, members);
      // 成功後直接跳轉，不需要存 localStorage，因為跳轉後的 URL 包含 code，會觸發上面的 useEffect
      router.replace(`/expenses?code=${res.code}`);
    } catch (e) {
      showToast("建立失敗，請檢查網絡", "error");
      setLoading(false);
    }
  };

  // 4. 新增支出 (Add Expense)
  const handleAddExpense = async () => {
    if (!data) return;
    if (!amount || !payerId || participantIds.length === 0) {
      showToast("資料不完整", "error");
      return;
    }

    try {
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
    } catch (e) {
      showToast("新增失敗", "error");
    }
  };

  // 5. 刪除支出 (Delete Expense)
  const handleDelete = async (expenseId: string) => {
    if (!data) return;
    if (!confirm("確定刪除?")) return;

    try {
      await deleteExpense(data.code, expenseId);
      await reloadTrip();
      showToast("已刪除");
    } catch (e) {
      showToast("刪除失敗", "error");
    }
  };

  // 計算結餘 (Balances)
  const balances = useMemo(() => {
    if (!data) return {};
    const bal: Record<string, number> = {};
    data.members.forEach((m) => (bal[m.id] = 0));

    data.expenses.forEach((e) => {
      const share = e.amountHKD / e.participants.length;
      bal[e.payerId] += e.amountHKD;
      e.participants.forEach((pid) => {
          if (bal[pid] !== undefined) bal[pid] -= share;
      });
    });

    return bal;
  }, [data]);

  // --- 畫面渲染邏輯 ---

  // 情況 A: 正在跟 Server 拿資料
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
            <div className="mb-2 text-xl">🚀</div>
            <div>正在讀取旅程...</div>
        </div>
      </div>
    );
  }

  // 情況 B: 有 code 但找不到資料 -> 顯示錯誤
  if (code && !data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
            <div className="mb-4 text-4xl">❌</div>
            <div className="text-xl mb-2">找不到旅程</div>
            <div className="text-sm text-gray-400 mb-6">代碼: {code}</div>
            <button onClick={() => router.push('/expenses')} className="px-6 py-3 bg-blue-600 rounded-xl">
                建立新旅程
            </button>
        </div>
      </div>
    );
  }

  // 情況 C: 沒有 code -> 顯示「建立新旅程」
  if (!code) {
    return (
      <div className="min-h-screen bg-black p-4 text-white pb-20">
        <div className="max-w-md mx-auto">
            <h1 className="text-3xl font-bold mb-6">建立新旅程</h1>

            <input
            className="w-full p-4 bg-[#1c1c1e] rounded-xl mb-4 border border-gray-800"
            placeholder="旅程名稱 (如: 東京之旅)"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
            />

            <div className="space-y-2 mb-6">
                {memberNames.map((n, i) => (
                <input
                    key={i}
                    className="w-full p-4 bg-[#1c1c1e] rounded-xl border border-gray-800"
                    placeholder={`成員 ${i + 1}`}
                    value={n}
                    onChange={(e) => {
                    const next = [...memberNames];
                    next[i] = e.target.value;
                    setMemberNames(next);
                    }}
                />
                ))}
            </div>

            <div className="flex gap-2">
                <button onClick={() => setMemberNames([...memberNames, ""])} className="px-4 py-3 bg-[#1c1c1e] rounded-xl border border-gray-800 text-gray-400">
                    +
                </button>
                <button onClick={handleCreateTrip} className="flex-1 py-3 bg-blue-600 rounded-xl font-bold">
                    開始旅程
                </button>
            </div>

            {toast && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 px-4 py-2 rounded-xl border border-gray-700 shadow-lg">{toast.msg}</div>}
        </div>
      </div>
    );
  }

  // 情況 D: 有 code 且有 data -> 顯示主畫面 (Dashboard)
  if (!data) {
    // 理論上不會到達這裡，但為了 TypeScript 類型安全
    return null;
  }

  return (
    <div className="min-h-screen bg-black p-4 text-white pb-24">
      <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">{data.name}</h1>
            <div className="flex gap-2">
              <button onClick={handleShareLink} className="text-xs px-3 py-2 bg-[#1c1c1e] rounded-lg text-gray-400 border border-gray-800 hover:bg-gray-800 transition-colors">
                  🔗 分享連結
              </button>
              <button onClick={() => router.push('/expenses')} className="text-xs px-3 py-2 bg-[#1c1c1e] rounded-lg text-gray-400 border border-gray-800 hover:bg-gray-800 transition-colors">
                  新旅程
              </button>
            </div>
          </div>

          {/* Total Card */}
          <div className="mb-6 p-6 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl shadow-lg border border-white/10">
            <div className="text-blue-100 text-sm mb-1">總開支</div>
            <div className="text-4xl font-bold">
                HKD {data.expenses.reduce((s, e) => s + e.amountHKD, 0).toFixed(2)}
            </div>
          </div>

          {/* Balances */}
          <div className="space-y-2 mb-8">
            <h3 className="font-bold text-gray-400 text-sm ml-1">結餘概況</h3>
            {Object.entries(balances).map(([id, bal]) => {
                const member = data.members.find((m) => m.id === id);
                if (!member) return null;
                return (
                    <div key={id} className="flex justify-between items-center bg-[#1c1c1e] p-4 rounded-2xl border border-gray-800">
                    <span className="font-medium">{member.name}</span>
                    <span className={bal > 0 ? "text-green-400" : bal < 0 ? "text-red-400" : "text-gray-500"}>
                        {bal > 0 ? `收 ${bal.toFixed(1)}` : bal < 0 ? `付 ${Math.abs(bal).toFixed(1)}` : "平手"}
                    </span>
                    </div>
                );
            })}
          </div>

          {/* Add Expense Form */}
          <div className="bg-[#1c1c1e] p-5 rounded-3xl border border-gray-800 mb-8 space-y-4">
             <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((c) => (
                    <button key={c.id} onClick={() => setCategory(c.id)}
                        className={`p-2 rounded-xl text-sm border transition-all ${category === c.id ? "bg-blue-600 border-blue-600 text-white" : "border-gray-700 text-gray-400 hover:bg-gray-800"}`}>
                        <span className="mr-1">{c.icon}</span>{c.label}
                    </button>
                ))}
             </div>

             <div className="flex gap-2">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-1/3 p-3 bg-black rounded-xl border border-gray-800" />
                <input type="number" placeholder="金額 (HKD)" value={amount} onChange={(e) => setAmount(e.target.value)} className="flex-1 p-3 bg-black rounded-xl border border-gray-800 font-bold" />
             </div>

             <input type="text" placeholder="備註 (選填)" value={note} onChange={(e) => setNote(e.target.value)} className="w-full p-3 bg-black rounded-xl border border-gray-800" />

             <div className="space-y-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <span className="text-xs text-gray-500 whitespace-nowrap">誰付錢:</span>
                    {data.members.map(m => (
                        <button key={m.id} onClick={() => setPayerId(m.id)}
                            className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap ${payerId === m.id ? "bg-blue-600 border-blue-600 text-white" : "border-gray-700 text-gray-400"}`}>
                            {m.name}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <span className="text-xs text-gray-500 whitespace-nowrap">誰分擔:</span>
                    {data.members.map(m => (
                        <button key={m.id} onClick={() => setParticipantIds(prev => prev.includes(m.id) ? prev.filter(p => p !== m.id) : [...prev, m.id])}
                            className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap ${participantIds.includes(m.id) ? "bg-blue-600 border-blue-600 text-white" : "border-gray-700 text-gray-400"}`}>
                            {m.name}
                        </button>
                    ))}
                </div>
             </div>

             <button onClick={handleAddExpense} className="w-full py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-colors">
                新增記錄
             </button>
          </div>

          {/* Records List */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-400 text-sm ml-1">最近記錄</h3>
            {data.expenses.length === 0 && <div className="text-center text-gray-600 py-4">暫無記錄</div>}
            {data.expenses.map((e) => (
                <div key={e.id} className="flex justify-between items-center bg-[#1c1c1e] p-4 rounded-2xl border border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="text-2xl">{CATEGORIES.find(c => c.id === e.category)?.icon || "📝"}</div>
                    <div>
                        <div className="font-bold">{e.title}</div>
                        <div className="text-xs text-gray-400">{new Date(e.date).toLocaleDateString()} · {data.members.find(m => m.id === e.payerId)?.name} 付款</div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="font-bold">${e.amountHKD.toFixed(1)}</div>
                    <button onClick={() => handleDelete(e.id)} className="text-xs text-red-500 mt-1 px-2 py-1 bg-red-500/10 rounded-lg">
                    刪除
                    </button>
                </div>
                </div>
            ))}
          </div>
      </div>

      {toast && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 px-4 py-2 rounded-xl border border-gray-700 shadow-lg z-50">{toast.msg}</div>}
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
