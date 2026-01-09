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

const CATEGORY_COLORS: Record<string, string> = {
  dining: '#3b82f6',    // blue
  transport: '#f97316', // orange
  hotel: '#a855f7',     // purple
  shopping: '#ec4899',  // pink
  activity: '#10b981',  // green
  other: '#6b7280',     // gray
};

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
  const [currency, setCurrency] = useState<'HKD' | 'JPY'>('HKD');
  const [exchangeRate, setExchangeRate] = useState(0.053); // JPY to HKD
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});

  // Accordion States
  const [balancesExpanded, setBalancesExpanded] = useState(false);
  const [settlementsExpanded, setSettlementsExpanded] = useState(false);
  const [recordsExpanded, setRecordsExpanded] = useState(false);

  // Toast Helper
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Share Link Handler
  const handleShareLink = async () => {
    if (typeof window !== "undefined") {
      // Try Web Share API first (mobile)
      if (navigator.share) {
        try {
          await navigator.share({
            title: data?.name || '旅程記帳',
            text: '一起來記帳吧！',
            url: window.location.href,
          });
          showToast("已分享");
          return;
        } catch (err) {
          // User cancelled or share failed, fall through to clipboard
          if ((err as Error).name === 'AbortError') return; // User cancelled
        }
      }

      // Fallback to clipboard
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
          // 預設填入第一個成員並全選參與者
          if (res.members.length > 0) {
            setPayerId(prev => prev || res.members[0].id);
            // 預設全選所有成員
            setParticipantIds(res.members.map((m) => m.id));
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

  // Load exchange rate from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedRate = localStorage.getItem('saved_exchange_rate');
      if (savedRate) {
        setExchangeRate(parseFloat(savedRate));
      }
    }
  }, []);

  // Reset custom splits when participants change or split mode changes
  useEffect(() => {
    if (splitMode === 'custom' && participantIds.length > 0) {
      const newSplits: Record<string, string> = {};
      participantIds.forEach(id => {
        newSplits[id] = customSplits[id] || '';
      });
      setCustomSplits(newSplits);
    }
  }, [participantIds, splitMode]);

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

    const amountValue = parseFloat(amount);
    const amountHKD = currency === 'JPY'
      ? amountValue * exchangeRate
      : amountValue;

    // Validate custom splits
    if (splitMode === 'custom') {
      const splitTotal = Object.values(customSplits)
        .reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
      const diff = Math.abs(amountHKD - splitTotal);

      if (diff > 1) {
        showToast(`分擔金額總和不正確 (差額: $${diff.toFixed(2)})`, "error");
        return;
      }

      // Check all participants have amounts
      const hasEmptySplits = participantIds.some(pid => !customSplits[pid] || parseFloat(customSplits[pid]) === 0);
      if (hasEmptySplits) {
        showToast("請輸入所有參與者的分擔金額", "error");
        return;
      }
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
        amountHKD,
        originalCurrency: currency,
        originalAmount: amountValue,
        customSplits: splitMode === 'custom' ? customSplits : undefined,
      });

      setAmount("");
      setNote("");
      setCurrency('HKD'); // Reset to HKD
      setSplitMode('equal'); // Reset split mode
      setCustomSplits({}); // Clear custom splits
      // 重新全選所有參與者
      setParticipantIds(data.members.map((m) => m.id));
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
      // Payer adds full amount
      bal[e.payerId] += e.amountHKD;

      // Participants subtract their share
      e.participants.forEach((participant) => {
        const memberId = typeof participant === 'string' ? participant : participant.id;

        if (bal[memberId] !== undefined) {
          // Check if custom split exists
          const customAmount = typeof participant === 'object' ? participant.customAmount : undefined;
          const share = customAmount !== undefined
            ? customAmount
            : e.amountHKD / e.participants.length;

          bal[memberId] -= share;
        }
      });
    });

    return bal;
  }, [data]);

  // 計算還款建議 (Settlement Plan)
  const settlements = useMemo(() => {
    if (!data) return [];

    // 建立債務人和債權人列表
    const debtors: Array<{ id: string; name: string; amount: number }> = [];
    const creditors: Array<{ id: string; name: string; amount: number }> = [];

    Object.entries(balances).forEach(([id, balance]) => {
      const member = data.members.find((m) => m.id === id);
      if (!member) return;

      if (balance < -0.01) {
        // 欠錢者 (negative balance)
        debtors.push({ id, name: member.name, amount: Math.abs(balance) });
      } else if (balance > 0.01) {
        // 借錢者 (positive balance)
        creditors.push({ id, name: member.name, amount: balance });
      }
    });

    // 按金額排序（由大到小）
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    // 生成還款建議
    const transactions: Array<{ from: string; to: string; amount: number }> = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const payment = Math.min(debtor.amount, creditor.amount);

      transactions.push({
        from: debtor.name,
        to: creditor.name,
        amount: payment,
      });

      debtor.amount -= payment;
      creditor.amount -= payment;

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return transactions;
  }, [data, balances]);

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
    <div className="min-h-screen bg-black p-4 pt-12 text-white pb-24">
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
          <div className="mb-6 p-6 bg-[#1c1c1e] rounded-3xl shadow-lg border border-gray-800">
            <div className="text-gray-400 text-sm mb-1">總開支</div>
            <div className="text-4xl font-bold text-white">
                HKD {data.expenses.reduce((s, e) => s + e.amountHKD, 0).toFixed(2)}
            </div>

            {/* Rainbow Proportion Bar */}
            {data.expenses.length > 0 && (() => {
              const total = data.expenses.reduce((s, e) => s + e.amountHKD, 0);
              if (total === 0) return null;

              // Calculate category totals
              const categoryTotals = CATEGORIES.map(cat => ({
                id: cat.id,
                label: cat.label,
                amount: data.expenses
                  .filter(e => e.category === cat.id)
                  .reduce((s, e) => s + e.amountHKD, 0),
              })).filter(c => c.amount > 0);

              if (categoryTotals.length === 0) return null;

              return (
                <div className="mt-4">
                  <div className="flex h-2 rounded-full overflow-hidden">
                    {categoryTotals.map(cat => (
                      <div
                        key={cat.id}
                        style={{
                          width: `${(cat.amount / total) * 100}%`,
                          backgroundColor: CATEGORY_COLORS[cat.id] || '#6b7280'
                        }}
                        title={`${cat.label}: $${cat.amount.toFixed(1)}`}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Add Expense Form - Moved to top */}
          <div className="bg-[#1c1c1e] p-5 rounded-3xl border border-gray-800 mb-8 space-y-4">
             <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((c) => {
                  const color = CATEGORY_COLORS[c.id] || '#6b7280';
                  const isSelected = category === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setCategory(c.id)}
                      className={`p-2 rounded-xl text-sm border-2 transition-all text-white ${
                        isSelected ? 'font-bold scale-105' : 'hover:scale-105'
                      }`}
                      style={{
                        borderColor: color,
                        backgroundColor: isSelected ? color : 'transparent',
                      }}
                    >
                      <span className="mr-1">{c.icon}</span>{c.label}
                    </button>
                  );
                })}
             </div>

             {/* Currency Toggle */}
             <div className="flex items-center gap-2">
               <span className="text-xs text-gray-500 whitespace-nowrap">幣別:</span>
               <button
                 onClick={() => setCurrency('JPY')}
                 className={`px-3 py-1 rounded-full text-xs border transition-all ${
                   currency === 'JPY'
                     ? 'bg-blue-600 border-blue-600 text-white font-bold'
                     : 'border-gray-700 text-gray-400 hover:bg-gray-800'
                 }`}
               >
                 JPY
               </button>
               <button
                 onClick={() => setCurrency('HKD')}
                 className={`px-3 py-1 rounded-full text-xs border transition-all ${
                   currency === 'HKD'
                     ? 'bg-blue-600 border-blue-600 text-white font-bold'
                     : 'border-gray-700 text-gray-400 hover:bg-gray-800'
                 }`}
               >
                 HKD
               </button>
             </div>

             {/* Date and Amount Input */}
             <div className="flex gap-2">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-1/3 p-3 bg-black rounded-xl border border-gray-800" />
                <div className="flex-1 min-w-0">
                  <input
                    type="number"
                    placeholder={currency === 'JPY' ? '金額 (JPY)' : '金額 (HKD)'}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-3 bg-black rounded-xl border border-gray-800 font-bold"
                  />
                  {currency === 'JPY' && amount && (
                    <div className="text-xs text-gray-500 mt-1 px-1">
                      ≈ HKD {(parseFloat(amount) * exchangeRate).toFixed(2)}
                    </div>
                  )}
                </div>
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

                {/* Split Mode Toggle */}
                {participantIds.length > 0 && (
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-xs text-gray-500 whitespace-nowrap">分擔方式:</span>
                    <button
                      onClick={() => {
                        setSplitMode('equal');
                        setCustomSplits({});
                      }}
                      className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap transition-all ${
                        splitMode === 'equal'
                          ? 'bg-blue-600 border-blue-600 text-white font-bold'
                          : 'border-gray-700 text-gray-400 hover:bg-gray-800'
                      }`}
                    >
                      平均分擔
                    </button>
                    <button
                      onClick={() => {
                        setSplitMode('custom');
                        const newSplits: Record<string, string> = {};
                        participantIds.forEach(id => {
                          newSplits[id] = '';
                        });
                        setCustomSplits(newSplits);
                      }}
                      className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap transition-all ${
                        splitMode === 'custom'
                          ? 'bg-blue-600 border-blue-600 text-white font-bold'
                          : 'border-gray-700 text-gray-400 hover:bg-gray-800'
                      }`}
                    >
                      詳細輸入
                    </button>
                  </div>
                )}

                {/* Custom Split Inputs */}
                {splitMode === 'custom' && participantIds.length > 0 && (
                  <div className="bg-black p-3 rounded-xl border border-gray-800 space-y-2">
                    <div className="text-xs text-gray-400 mb-2">輸入各人分擔金額 (HKD):</div>
                    {participantIds.map(pid => {
                      const member = data.members.find(m => m.id === pid);
                      if (!member) return null;

                      return (
                        <div key={pid} className="flex items-center gap-2">
                          <span className="text-sm text-gray-300 w-20">{member.name}:</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={customSplits[pid] || ''}
                            onChange={(e) => {
                              setCustomSplits(prev => ({
                                ...prev,
                                [pid]: e.target.value,
                              }));
                            }}
                            className="flex-1 p-2 bg-[#1c1c1e] rounded-lg border border-gray-700 text-sm"
                          />
                        </div>
                      );
                    })}

                    {/* Validation Display */}
                    {(() => {
                      const total = currency === 'JPY' && amount
                        ? parseFloat(amount) * exchangeRate
                        : parseFloat(amount) || 0;
                      const splitTotal = Object.values(customSplits)
                        .reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
                      const diff = Math.abs(total - splitTotal);

                      if (total > 0 && splitTotal > 0) {
                        return (
                          <div className={`text-xs mt-2 ${diff <= 1 ? 'text-green-400' : 'text-red-400'}`}>
                            已分配: ${splitTotal.toFixed(2)} / ${total.toFixed(2)}
                            {diff > 1 && ` (差額: $${diff.toFixed(2)})`}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
             </div>

             <button onClick={handleAddExpense} className="w-full py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-colors">
                新增記錄
             </button>
          </div>

          {/* Balances Section */}
          <div className="bg-[#1c1c1e] rounded-3xl border border-gray-800 overflow-hidden mb-4">
            <button
              onClick={() => setBalancesExpanded(!balancesExpanded)}
              className="w-full p-4 flex justify-between items-center hover:bg-gray-800/50 transition-colors"
            >
              <h3 className="font-bold text-gray-300">結餘狀況</h3>
              <span className="text-gray-500 text-sm">
                {balancesExpanded ? "▲" : "▼"}
              </span>
            </button>

            {balancesExpanded && (
              <div className="px-4 pb-4 space-y-2">
                {Object.entries(balances).map(([id, bal]) => {
                  const member = data.members.find((m) => m.id === id);
                  if (!member) return null;

                  // Calculate 總墊支 (Total Paid)
                  const totalPaid = data.expenses
                    .filter(e => e.payerId === id)
                    .reduce((sum, e) => sum + e.amountHKD, 0);

                  // Calculate 總消費 (Total Consumed)
                  const totalConsumed = data.expenses
                    .filter(e => e.participants.some(p => {
                      const memberId = typeof p === 'string' ? p : p.id;
                      return memberId === id;
                    }))
                    .reduce((sum, e) => {
                      // Find this member's participant record
                      const participant = e.participants.find(p => {
                        const memberId = typeof p === 'string' ? p : p.id;
                        return memberId === id;
                      });

                      if (!participant) return sum;

                      // Check if custom split exists
                      const customAmount = typeof participant === 'object' ? participant.customAmount : undefined;
                      const share = customAmount !== undefined
                        ? customAmount
                        : e.amountHKD / e.participants.length;

                      return sum + share;
                    }, 0);

                  return (
                    <div key={id} className="bg-black p-3 rounded-xl">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium">{member.name}</span>
                        <span className={bal > 0 ? "text-green-400" : bal < 0 ? "text-red-400" : "text-gray-500"}>
                          {bal > 0 ? `收 ${bal.toFixed(1)}` : bal < 0 ? `付 ${Math.abs(bal).toFixed(1)}` : "平手"}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        總墊支: ${totalPaid.toFixed(1)} • 總消費: ${totalConsumed.toFixed(1)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Settlement Plan Section */}
          <div className="bg-[#1c1c1e] rounded-3xl border border-gray-800 overflow-hidden mb-4">
            <button
              onClick={() => setSettlementsExpanded(!settlementsExpanded)}
              className="w-full p-4 flex justify-between items-center hover:bg-gray-800/50 transition-colors"
            >
              <h3 className="font-bold text-gray-300">建議還款方案</h3>
              <span className="text-gray-500 text-sm">
                {settlementsExpanded ? "▲" : "▼"}
              </span>
            </button>

            {settlementsExpanded && (
              <div className="px-4 pb-4">
                {settlements.length === 0 ? (
                  <div className="text-center text-gray-500 py-3">暫無須結算</div>
                ) : (
                  <div className="space-y-2">
                    {settlements.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-black p-3 rounded-xl">
                        <span className="text-lg">💸</span>
                        <div className="flex-1">
                          <span className="font-medium text-red-400">{s.from}</span>
                          <span className="text-gray-400 mx-2">→</span>
                          <span className="font-medium text-green-400">{s.to}</span>
                        </div>
                        <span className="font-bold text-yellow-400">${s.amount.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Records List - Now Collapsible */}
          <div className="bg-[#1c1c1e] rounded-3xl border border-gray-800 overflow-hidden mb-4">
            <button
              onClick={() => setRecordsExpanded(!recordsExpanded)}
              className="w-full p-4 flex justify-between items-center hover:bg-gray-800/50 transition-colors"
            >
              <h3 className="font-bold text-gray-300">最近記錄</h3>
              <span className="text-gray-500 text-sm">
                {recordsExpanded ? "▲" : "▼"}
              </span>
            </button>

            {recordsExpanded && (
              <div className="px-4 pb-4 space-y-2">
                {data.expenses.length === 0 && <div className="text-center text-gray-500 py-3">暫無記錄</div>}
                {data.expenses.map((e) => {
                  // Calculate beneficiaries display
                  const allParticipants = e.participants.length === data.members.length;
                  const beneficiariesText = allParticipants
                    ? "全員"
                    : e.participants.map(p => {
                        const memberId = typeof p === 'string' ? p : p.id;
                        return data.members.find(m => m.id === memberId)?.name;
                      }).filter(Boolean).join(", ");

                  return (
                    <div key={e.id} className="flex justify-between items-center bg-black p-3 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="text-xl">{CATEGORIES.find(c => c.id === e.category)?.icon || "📝"}</div>
                        <div>
                          <div className="font-bold text-sm">{e.title}</div>
                          <div className="text-xs text-gray-400">
                            {new Date(e.date).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {data.members.find(m => m.id === e.payerId)?.name} 付款 • {beneficiariesText}
                            {e.originalCurrency && e.originalCurrency !== 'HKD' && e.originalAmount && (
                              <span className="ml-1 text-gray-600">(原本 {e.originalCurrency} {e.originalAmount.toFixed(0)})</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm">${e.amountHKD.toFixed(1)}</div>
                        <button onClick={() => handleDelete(e.id)} className="text-xs text-red-500 mt-1 px-2 py-1 bg-red-500/10 rounded-lg">
                          刪除
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
