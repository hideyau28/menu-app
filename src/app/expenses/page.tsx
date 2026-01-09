"use client";

import { useEffect, useState } from "react";

interface Member {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  title: string;
  totalAmountHKD: number;
  payerId: string;
  participants: string[];
  date?: string;
  timestamp: number;
  category?: string;
  currency?: string;
  foreignAmount?: number;
  note?: string;
}

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

const CATEGORIES = [
  { id: "dining", label: "餐飲", icon: "🍽️" },
  { id: "transport", label: "交通", icon: "🚗" },
  { id: "hotel", label: "住宿", icon: "🏨" },
  { id: "shopping", label: "購物", icon: "🛍️" },
  { id: "activity", label: "活動", icon: "🎡" },
  { id: "other", label: "其他", icon: "📝" },
];

export default function ExpensesPage() {
  // --- State ---
  const [members, setMembers] = useState<Member[]>([]);
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [setupNames, setSetupNames] = useState<string[]>(["", ""]);

  // Input States
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [payerId, setPayerId] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [category, setCategory] = useState("dining");
  const [currency, setCurrency] = useState("HKD");
  const [currencyRate, setCurrencyRate] = useState("1");
  const [foreignAmount, setForeignAmount] = useState("");
  const [note, setNote] = useState("");

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editing, setEditing] = useState<{ [key: string]: Expense }>({});

  // UI States
  const [showBalances, setShowBalances] = useState(false);
  const [showSettlements, setShowSettlements] = useState(false);
  const [showRecords, setShowRecords] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // --- Effects ---
  useEffect(() => {
    // Load Members
    const savedMembers = localStorage.getItem("tripUtility_members");
    if (savedMembers) {
      const parsed: Member[] = JSON.parse(savedMembers);
      if (parsed.length === 0) {
        setIsSetupMode(true);
      } else {
        setMembers(parsed);
        setPayerId(parsed[0].id);
        setParticipants(parsed.map((m) => m.id));

        // Handle Prefill (if coming from other pages)
        const prefillRaw = localStorage.getItem("tripUtility_prefill_expense");
        if (prefillRaw) {
          try {
            const prefill = JSON.parse(prefillRaw);
            if (prefill.hkdActual) setAmount(String(prefill.hkdActual));
            setParticipants(parsed.map((m) => m.id));
            localStorage.removeItem("tripUtility_prefill_expense");
          } catch (e) {
            localStorage.removeItem("tripUtility_prefill_expense");
          }
        }
      }
    } else {
      setIsSetupMode(true);
    }

    // Load Expenses
    const savedExpenses = localStorage.getItem("tripUtility_expenses");
    if (savedExpenses) {
      try {
        const parsed = JSON.parse(savedExpenses);
        if (parsed.length > 0 && parsed[0].totalAmountHKD !== undefined && parsed[0].payerId !== undefined) {
          setExpenses(parsed);
        } else {
          localStorage.removeItem("tripUtility_expenses");
        }
      } catch (e) {
        localStorage.removeItem("tripUtility_expenses");
      }
    }
  }, []);

  // Toast Timer
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // --- Helper Functions ---
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
  };

  const handleSetupComplete = () => {
    const validNames = setupNames.filter((n) => n.trim() !== "");
    if (validNames.length < 2) {
      showToast("最少需要 2 位旅遊夥伴", "error");
      return;
    }
    if (validNames.length > 10) {
      showToast("最多 10 位旅遊夥伴", "error");
      return;
    }
    const newMembers: Member[] = validNames.map((name) => ({
      id: Date.now().toString() + Math.random(),
      name: name.trim(),
    }));
    setMembers(newMembers);
    setPayerId(newMembers[0].id);
    setParticipants(newMembers.map((m) => m.id));
    localStorage.setItem("tripUtility_members", JSON.stringify(newMembers));
    setIsSetupMode(false);
  };

  const handleResetTrip = () => {
    if (!confirm("確定要重設整個旅程？所有記錄將被清除。")) return;

    localStorage.removeItem("tripUtility_members");
    localStorage.removeItem("tripUtility_expenses");
    localStorage.removeItem("tripUtility_localCurrency");
    localStorage.removeItem("tripUtility_prefill_expense");

    setMembers([]);
    setExpenses([]);
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    setPayerId("");
    setParticipants([]);
    setEditing({});
    setSetupNames(["", ""]);
    setCurrency("HKD");
    setForeignAmount("");
    setIsSetupMode(true);
  };

  const handleSave = () => {
    if ((!amount && !foreignAmount) || !payerId || participants.length === 0) {
      showToast("請填寫所有欄位", "error");
      return;
    }

    const hkdAmount = currency === "HKD"
      ? Number(amount)
      : Number(foreignAmount) * Number(currencyRate);

    const categoryLabel = CATEGORIES.find((c) => c.id === category)?.label || "其他";

    const newExpense: Expense = {
      id: Date.now().toString(),
      title: categoryLabel,
      totalAmountHKD: hkdAmount,
      payerId,
      participants,
      date,
      timestamp: Date.now(),
      category,
      currency: currency !== "HKD" ? currency : undefined,
      foreignAmount: currency !== "HKD" ? Number(foreignAmount) : undefined,
      note: note.trim() || undefined,
    };

    const updated = [newExpense, ...expenses];
    setExpenses(updated);
    localStorage.setItem("tripUtility_expenses", JSON.stringify(updated));

    // Reset Form
    setAmount("");
    setForeignAmount("");
    setCurrency("HKD");
    setCurrencyRate("1");
    setCategory("dining");
    setNote("");
    setDate(new Date().toISOString().slice(0, 10));
    setParticipants(members.map((m) => m.id));

    showToast("✅ 已新增記錄");
  };

  const startEdit = (expense: Expense) => {
    setEditing({ [expense.id]: { ...expense } });
    setDeleteConfirmId(null); // Reset delete state
  };

  const confirmEdit = (id: string) => {
    const edited = editing[id];
    if (!edited) return;

    const updated = expenses.map((e) => (e.id === id ? edited : e));
    setExpenses(updated);
    localStorage.setItem("tripUtility_expenses", JSON.stringify(updated));

    const next = { ...editing };
    delete next[id];
    setEditing(next);
    showToast("✅ 修改成功");
  };

  const cancelEdit = (id: string) => {
    const next = { ...editing };
    delete next[id];
    setEditing(next);
  };

  const deleteExpense = (id: string) => {
    const updated = expenses.filter((e) => e.id !== id);
    setExpenses(updated);
    localStorage.setItem("tripUtility_expenses", JSON.stringify(updated));
    showToast("🗑️ 已刪除記錄");
  };

  const calculateBalances = (): { [key: string]: number } => {
    const balances: { [key: string]: number } = {};
    members.forEach((m) => (balances[m.id] = 0));

    expenses.forEach((expense) => {
      const share = expense.totalAmountHKD / expense.participants.length;
      balances[expense.payerId] += expense.totalAmountHKD;
      expense.participants.forEach((pid) => {
        balances[pid] -= share;
      });
    });

    return balances;
  };

  const calculateSettlements = (): Settlement[] => {

    const debtors = members
      .filter((m) => balances[m.id] < -0.01)
      .map((m) => ({
        id: m.id,
        amount: -balances[m.id],
      }));

    const creditors = members
      .filter((m) => balances[m.id] > 0.01)
      .map((m) => ({
        id: m.id,
        amount: balances[m.id],
      }));

    const settlements: Settlement[] = [];
    let i = 0,
      j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debt = debtors[i].amount;
      const credit = creditors[j].amount;
      const amount = Math.min(debt, credit);

      settlements.push({
        from: debtors[i].id,
        to: creditors[j].id,
        amount: amount,
      });

      debtors[i].amount -= amount;
      creditors[j].amount -= amount;

      if (debtors[i].amount < 0.01) i++;
      if (creditors[j].amount < 0.01) j++;
    }

    return settlements;
  };

  const toggleParticipant = (id: string) => {
    setParticipants((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleEditParticipant = (expenseId: string, memberId: string) => {
    const expense = editing[expenseId];
    if (!expense) return;

    const updated = expense.participants.includes(memberId)
      ? expense.participants.filter((x) => x !== memberId)
      : [...expense.participants, memberId];

    setEditing({
      ...editing,
      [expenseId]: { ...expense, participants: updated },
    });
  };

  const copySummary = () => {
    const balanceText = members.map((m) => {
      const balance = balances[m.id];
      if (balance > 0.01) return `${m.name}: 應收 HKD ${balance.toFixed(2)}`;
      if (balance < -0.01) return `${m.name}: 應付 HKD ${(-balance).toFixed(2)}`;
      return `${m.name}: 已結清`;
    }).join("\n");

    const settlementText = settlements.length === 0
      ? "所有帳目已結清"
      : settlements.map((s) => {
        const fromName = members.find((m) => m.id === s.from)?.name;
        const toName = members.find((m) => m.id === s.to)?.name;
        return `${fromName} 俾 ${toName}：HKD ${s.amount.toFixed(2)}`;
      }).join("\n");

    const summary = `結餘：\n${balanceText}\n\n結算方案：\n${settlementText}`;

    navigator.clipboard.writeText(summary).then(() => {
      showToast("✅ 已複製到剪貼簿");
    });
  };

  const getCategoryIcon = (categoryId?: string) => {
    return CATEGORIES.find((c) => c.id === categoryId)?.icon || "📝";
  };

  const groupExpensesByDate = () => {
    const groups: { [date: string]: Expense[] } = {};
    expenses.forEach((expense) => {
      // 如果 timestamp 有問題，就用今日日期，防止崩潰
      const date = expense.date || (expense.timestamp ? new Date(expense.timestamp).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
      if (!groups[date]) groups[date] = [];
      groups[date].push(expense);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  };

  // Calculations for Rendering
  const balances = calculateBalances();
  const settlements = calculateSettlements();
  const groupedExpenses = groupExpensesByDate();

  const totalExpenses = expenses.reduce((sum, item) => sum + item.totalAmountHKD, 0);
  const averagePerPerson = members.length > 0 ? totalExpenses / members.length : 0;

  // Render Setup Mode
  if (members.length === 0 || isSetupMode) {
    return (
      <div className="min-h-screen bg-black p-4 pb-24">
        <div className="max-w-xl mx-auto">
          <h1 className="text-3xl font-semibold mb-2 text-white">旅遊夥伴設定</h1>
          <p className="text-sm text-gray-400 mb-6">最少 2 人，最多 10 人</p>

          <div className="space-y-3 mb-6">
            {setupNames.map((name, idx) => (
              <input
                key={idx}
                className="w-full p-4 bg-[#1c1c1e] text-white border border-gray-800 rounded-2xl focus:border-[#007AFF] focus:outline-none"
                placeholder={`夥伴 ${idx + 1}`}
                value={name}
                onChange={(e) => {
                  const updated = [...setupNames];
                  updated[idx] = e.target.value;
                  setSetupNames(updated);
                }}
              />
            ))}
          </div>

          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setSetupNames([...setupNames, ""])}
              className="flex-1 py-3 rounded-2xl bg-[#1c1c1e] border border-gray-800 text-white font-medium active:opacity-70 disabled:opacity-30"
              disabled={setupNames.length >= 10}
            >
              加人
            </button>
            <button
              onClick={() => {
                if (setupNames.length > 2) {
                  setSetupNames(setupNames.slice(0, -1));
                }
              }}
              className="flex-1 py-3 rounded-2xl bg-[#1c1c1e] border border-gray-800 text-white font-medium active:opacity-70 disabled:opacity-30"
              disabled={setupNames.length <= 2}
            >
              減人
            </button>
          </div>

          <button
            onClick={handleSetupComplete}
            className="w-full py-4 rounded-2xl bg-[#007AFF] text-white font-semibold text-lg active:opacity-80"
          >
            開始
          </button>
        </div>
        {/* Toast Component */}
        {toast && (
          <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-50 border border-white/10 ${toast.type === "error" ? "bg-red-900/90 text-white" : "bg-[#2c2c2e]/90 text-white backdrop-blur-md"}`}>
            {toast.msg}
          </div>
        )}
      </div>
    );
  }

  // Render Main App
  return (
    <div className="min-h-screen bg-black p-4 pb-24">
      <div className="max-w-xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-semibold text-white">夾錢</h1>
          <button
            onClick={handleResetTrip}
            className="text-xs px-3 py-2 rounded-xl bg-[#1c1c1e] border border-red-900 text-red-400 active:opacity-70"
          >
            重設旅程
          </button>
        </div>

        {/* Dashboard Card - Total Expenses */}
        {expenses.length > 0 && (
          <div className="mb-6 p-6 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg border border-white/10">
            <div className="text-blue-100 text-sm mb-1 font-medium">總開支</div>
            <div className="text-4xl font-bold mb-4">HKD {totalExpenses.toFixed(2)}</div>
            <div className="flex justify-between items-end border-t border-white/20 pt-3">
              <div className="text-blue-100 text-xs">平均每人</div>
              <div className="text-lg font-semibold">HKD {averagePerPerson.toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* Input Form */}
        <div className="space-y-4 bg-[#1c1c1e] border border-gray-800 p-5 rounded-3xl mb-6">
          <div>
            <div className="mb-3 text-base font-semibold text-white">類別</div>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`px-3 py-3 rounded-2xl border text-sm font-medium active:opacity-70 transition-colors ${category === cat.id
                    ? "bg-[#007AFF] border-[#007AFF] text-white"
                    : "bg-transparent border-gray-700 text-gray-300"
                    }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          <input
            className="w-full p-4 bg-black text-white border border-gray-800 rounded-2xl focus:border-[#007AFF] focus:outline-none"
            placeholder="備註（選填）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <div className="flex gap-3">
            <div className="relative">
              <select
                className="h-full px-4 py-3 bg-[#1c1c1e] text-white border border-gray-800 rounded-2xl focus:border-[#007AFF] focus:outline-none appearance-none pr-8 font-medium"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="HKD">HKD</option>
                <option value="JPY">JPY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="TWD">TWD</option>
                <option value="KRW">KRW</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
            </div>

            {currency === "HKD" ? (
              <input
                className="flex-1 p-4 bg-black text-white border border-gray-800 rounded-2xl focus:border-[#007AFF] focus:outline-none"
                placeholder="金額 HKD"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            ) : (
              <>
                <input
                  className="flex-1 p-4 bg-black text-white border border-gray-800 rounded-2xl focus:border-[#007AFF] focus:outline-none"
                  placeholder={`金額 ${currency}`}
                  type="number"
                  inputMode="decimal"
                  value={foreignAmount}
                  onChange={(e) => setForeignAmount(e.target.value)}
                />
                <input
                  className="w-24 p-4 bg-black text-white border border-gray-800 rounded-2xl focus:border-[#007AFF] focus:outline-none"
                  placeholder="匯率"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={currencyRate}
                  onChange={(e) => setCurrencyRate(e.target.value)}
                />
              </>
            )}
          </div>

          {currency !== "HKD" && foreignAmount && currencyRate && (
            <div className="text-sm text-gray-400 px-2">
              ≈ HKD {(Number(foreignAmount) * Number(currencyRate)).toFixed(2)}
            </div>
          )}

          <div className="flex gap-3">
            <input
              className="flex-1 p-4 bg-black text-white border border-gray-800 rounded-2xl focus:border-[#007AFF] focus:outline-none"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-gray-400">邊個俾錢：</div>
            <div className="flex gap-2 flex-wrap">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPayerId(m.id)}
                  className={`px-4 py-2 rounded-full border text-sm font-medium active:opacity-70 transition-colors ${payerId === m.id
                    ? "bg-[#007AFF] border-[#007AFF] text-white"
                    : "bg-transparent border-gray-700 text-gray-300"
                    }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-gray-400">邊啲人要夾：</div>
            <div className="flex gap-2 flex-wrap">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => toggleParticipant(m.id)}
                  className={`px-4 py-2 rounded-full border text-sm font-medium active:opacity-70 transition-colors ${participants.includes(m.id)
                    ? "bg-[#007AFF] border-[#007AFF] text-white"
                    : "bg-transparent border-gray-700 text-gray-300"
                    }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-4 rounded-2xl bg-[#007AFF] text-white font-semibold text-lg active:opacity-80 transition-opacity"
          >
            儲存
          </button>
        </div>

        {/* Info Cards (Balances & Settlements) */}
        {expenses.length > 0 && (
          <>
            <div className="mb-6 bg-[#1c1c1e] border border-gray-800 rounded-3xl overflow-hidden">
              <div
                onClick={() => setShowBalances(!showBalances)}
                className="p-5 cursor-pointer active:bg-white/5 flex justify-between items-center transition-colors"
              >
                <h2 className="text-xl font-semibold text-white">結餘</h2>
                <span className="text-gray-400">{showBalances ? "▼" : "▶"}</span>
              </div>
              {showBalances && (
                <div className="px-5 pb-5">
                  <div className="space-y-3">
                    {members.map((m) => {
                      const balance = balances[m.id];
                      return (
                        <div key={m.id} className="flex justify-between items-center">
                          <div className="text-gray-300">{m.name}</div>
                          <div className={`font-semibold ${balance > 0.01 ? 'text-green-400' : balance < -0.01 ? 'text-red-400' : 'text-gray-500'}`}>
                            {balance > 0.01
                              ? `應收 HKD ${balance.toFixed(2)}`
                              : balance < -0.01
                                ? `應付 HKD ${(-balance).toFixed(2)}`
                                : "已結清"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mb-6 bg-[#1c1c1e] border border-gray-800 rounded-3xl overflow-hidden">
              <div
                onClick={() => setShowSettlements(!showSettlements)}
                className="p-5 cursor-pointer active:bg-white/5 flex justify-between items-center transition-colors"
              >
                <h2 className="text-xl font-semibold text-white">結算方案</h2>
                <span className="text-gray-400">{showSettlements ? "▼" : "▶"}</span>
              </div>
              {showSettlements && (
                <div className="px-5 pb-5">
                  {settlements.length === 0 ? (
                    <div className="text-sm text-gray-500">所有帳目已結清</div>
                  ) : (
                    <>
                      <div className="space-y-3 mb-4">
                        {settlements.map((s, idx) => {
                          const fromName = members.find((m) => m.id === s.from)?.name;
                          const toName = members.find((m) => m.id === s.to)?.name;
                          return (
                            <div key={idx} className="p-3 rounded-2xl bg-black border border-gray-800">
                              <span className="font-medium text-white">{fromName}</span>
                              <span className="text-gray-400"> 俾 </span>
                              <span className="font-medium text-white">{toName}</span>
                              <span className="text-gray-400">：</span>
                              <span className="font-semibold text-green-400"> HKD {s.amount.toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        onClick={copySummary}
                        className="w-full py-3 rounded-2xl bg-black border border-gray-700 text-gray-300 text-sm font-medium active:opacity-70 transition-colors"
                      >
                        複製摘要
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Expenses List */}
        <div className="bg-[#1c1c1e] border border-gray-800 rounded-3xl overflow-hidden">
          <div
            onClick={() => setShowRecords(!showRecords)}
            className="p-5 cursor-pointer active:bg-white/5 flex justify-between items-center transition-colors"
          >
            <h2 className="text-xl font-semibold text-white">記錄 ({expenses.length})</h2>
            <span className="text-gray-400">{showRecords ? "▼" : "▶"}</span>
          </div>
          {showRecords && (
            <div className="px-5 pb-5">
              {expenses.length === 0 && <div className="text-sm text-gray-500">未有記錄</div>}

              <div className="space-y-6">
                {groupedExpenses.map(([dateStr, dateExpenses]) => (
                  <div key={dateStr}>
                    {/* Sticky Date Header */}
                    <div className="sticky top-0 z-10 py-2 bg-[#1c1c1e]/95 backdrop-blur-sm mb-3">
                      <div className="inline-block px-3 py-1 rounded-lg bg-black border border-gray-800 text-sm font-bold text-white shadow-sm">
                        📅 {new Date(dateStr).toLocaleDateString("zh-HK", {
                          month: "short",
                          day: "numeric",
                          weekday: "short"
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {dateExpenses
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .map((expense) => {
                          const isEditing = editing[expense.id] !== undefined;
                          const current = isEditing ? editing[expense.id] : expense;
                          const payerName = members.find((m) => m.id === current.payerId)?.name;
                          const participantNames = current.participants
                            .map((pid) => members.find((m) => m.id === pid)?.name)
                            .filter(Boolean)
                            .join("、");

                          return (
                            <div key={expense.id} className="p-4 bg-black border border-gray-800 rounded-3xl">
                              {isEditing ? (
                                <>
                                  <input
                                    className="w-full p-3 bg-[#1c1c1e] text-white border border-gray-800 rounded-2xl mb-3 focus:border-[#007AFF] focus:outline-none"
                                    value={current.title}
                                    onChange={(e) =>
                                      setEditing({
                                        ...editing,
                                        [expense.id]: { ...current, title: e.target.value },
                                      })
                                    }
                                  />
                                  <input
                                    className="w-full p-3 bg-[#1c1c1e] text-white border border-gray-800 rounded-2xl mb-3 focus:border-[#007AFF] focus:outline-none"
                                    type="number"
                                    inputMode="decimal"
                                    value={current.totalAmountHKD}
                                    onChange={(e) =>
                                      setEditing({
                                        ...editing,
                                        [expense.id]: { ...current, totalAmountHKD: Number(e.target.value) },
                                      })
                                    }
                                  />
                                  <input
                                    className="w-full p-3 bg-[#1c1c1e] text-white border border-gray-800 rounded-2xl mb-3 focus:border-[#007AFF] focus:outline-none"
                                    type="date"
                                    value={current.date || (current.timestamp ? new Date(current.timestamp).toISOString().slice(0, 10) : '')}
                                    onChange={(e) =>
                                      setEditing({
                                        ...editing,
                                        [expense.id]: { ...current, date: e.target.value },
                                      })
                                    }
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => confirmEdit(expense.id)}
                                      className="flex-1 py-3 rounded-2xl bg-[#007AFF] text-white text-sm font-medium active:opacity-80"
                                    >
                                      確認
                                    </button>
                                    <button
                                      onClick={() => cancelEdit(expense.id)}
                                      className="flex-1 py-3 rounded-2xl border border-gray-700 text-gray-300 text-sm font-medium active:opacity-70"
                                    >
                                      取消
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xl">{getCategoryIcon(current.category)}</span>
                                      <div className="font-semibold text-white text-lg">{current.title}</div>
                                    </div>
                                    <div className="font-semibold text-white text-lg">HKD {current.totalAmountHKD.toFixed(2)}</div>
                                  </div>
                                  {current.currency && current.foreignAmount && (
                                    <div className="text-xs text-gray-500 mb-1">
                                      {current.currency} {current.foreignAmount.toFixed(2)}
                                    </div>
                                  )}
                                  <div className="text-sm text-gray-400 mb-3">
                                    {payerName} 俾錢 · 夾：{participantNames || "（無）"}
                                  </div>
                                  {current.note && (
                                    <div className="text-sm text-gray-300 mb-3 px-3 py-2 bg-[#1c1c1e] rounded-xl border border-gray-800">
                                      {current.note}
                                    </div>
                                  )}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => startEdit(expense)}
                                      className="text-xs px-4 py-2 rounded-xl border border-gray-700 text-gray-300 active:opacity-70"
                                    >
                                      修改
                                    </button>

                                    {/* Custom Delete Button Logic */}
                                    <button
                                      onClick={() => {
                                        if (deleteConfirmId === expense.id) {
                                          deleteExpense(expense.id);
                                        } else {
                                          setDeleteConfirmId(expense.id);
                                          // Auto reset after 3 seconds
                                          setTimeout(() => setDeleteConfirmId(null), 3000);
                                        }
                                      }}
                                      className={`text-xs px-4 py-2 rounded-xl border transition-all active:opacity-70 ${deleteConfirmId === expense.id
                                        ? "border-red-600 bg-red-600 text-white"
                                        : "border-red-900 text-red-400"
                                        }`}
                                    >
                                      {deleteConfirmId === expense.id ? "確定?" : "刪除"}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification Container */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-50 border border-white/10 transition-all duration-300 ${toast.type === "error" ? "bg-red-900/90" : "bg-[#2c2c2e]/90"} text-white backdrop-blur-md flex items-center gap-2`}>
          <span>{toast.msg}</span>
        </div>
      )}2
    </div>
  );
}