"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createTrip, getTripByCode, addExpense, deleteExpense, updateExpense } from "./actions";
import { toast, Toaster } from 'sonner';

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

const CURRENCIES = [
  { code: 'HKD', label: 'HKD 港幣', flag: '🇭🇰' },
  { code: 'JPY', label: 'JPY 日圓', flag: '🇯🇵' },
  { code: 'USD', label: 'USD 美元', flag: '🇺🇸' },
  { code: 'CNY', label: 'CNY 人民幣', flag: '🇨🇳' },
  { code: 'EUR', label: 'EUR 歐元', flag: '🇪🇺' },
  { code: 'GBP', label: 'GBP 英鎊', flag: '🇬🇧' },
  { code: 'CAD', label: 'CAD 加幣', flag: '🇨🇦' },
  { code: 'KRW', label: 'KRW 韓圜', flag: '🇰🇷' },
  { code: 'TWD', label: 'TWD 新台幣', flag: '🇹🇼' },
  { code: 'THB', label: 'THB 泰銖', flag: '🇹🇭' },
  { code: 'AUD', label: 'AUD 澳元', flag: '🇦🇺' },
  { code: 'OTHER', label: '其他幣種...', flag: '🌍' },
] as const;

const AVATAR_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4', // cyan
];

const getAvatarColor = (index: number) => {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
};

const getAvatarText = (name: string) => {
  if (!name) return '?';

  // Check if the name contains Chinese characters
  const hasChinese = /[\u4e00-\u9fff]/.test(name);

  if (hasChinese) {
    // For Chinese names, take the first character
    return name.charAt(0);
  } else {
    // For English names, take the first 2 letters and uppercase
    return name.substring(0, 2).toUpperCase();
  }
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
  const [currency, setCurrency] = useState<string>('HKD');
  const [customCurrency, setCustomCurrency] = useState('');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});

  // Editing State
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Accordion States
  const [balancesExpanded, setBalancesExpanded] = useState(false);
  const [settlementsExpanded, setSettlementsExpanded] = useState(false);
  const [recordsExpanded, setRecordsExpanded] = useState(false);

  // Modal States
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);

  // Date Grouping State
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Toast Helper using Sonner
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    if (type === "success") {
      toast.success(msg, {
        duration: 2000,
        style: {
          background: '#10b981',
          color: 'white',
          border: 'none',
        },
      });
    } else {
      toast.error(msg, {
        duration: 3000,
        style: {
          background: '#ef4444',
          color: 'white',
          border: 'none',
        },
      });
    }
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

  // Load exchange rates from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedRates = localStorage.getItem('exchange_rates');
      if (savedRates) {
        try {
          setExchangeRates(JSON.parse(savedRates));
        } catch (e) {
          console.error('Failed to parse exchange rates:', e);
        }
      }
    }
  }, []);

  // Save exchange rates to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && Object.keys(exchangeRates).length > 0) {
      localStorage.setItem('exchange_rates', JSON.stringify(exchangeRates));
    }
  }, [exchangeRates]);

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

  // 輔助函數：獲取最終幣種代碼
  const getFinalCurrency = () => {
    if (currency === 'OTHER') {
      return customCurrency.trim() || 'OTHER';
    }
    return currency;
  };

  // 輔助函數：計算 HKD 金額
  const calculateHKD = () => {
    if (!amount) return 0;
    const finalCurrency = getFinalCurrency();

    if (finalCurrency === 'HKD') {
      return parseFloat(amount);
    }

    const rate = exchangeRates[finalCurrency] || 0;
    return parseFloat(amount) * rate;
  };

  // 4. 新增支出 (Add Expense)
  const handleAddExpense = async () => {
    if (!data) return;
    if (!amount || !payerId || participantIds.length === 0) {
      showToast("資料不完整", "error");
      return;
    }

    const finalCurrency = getFinalCurrency();
    const amountValue = parseFloat(amount);

    // Validate exchange rate for non-HKD currencies
    if (finalCurrency !== 'HKD') {
      const rate = exchangeRates[finalCurrency];
      if (!rate || rate === 0) {
        showToast(`請先輸入 ${finalCurrency} 的匯率`, "error");
        return;
      }
    }

    const amountHKD = finalCurrency === 'HKD'
      ? amountValue
      : amountValue * (exchangeRates[finalCurrency] || 0);

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
        originalCurrency: finalCurrency,
        originalAmount: amountValue,
        customSplits: splitMode === 'custom' ? customSplits : undefined,
      });

      setAmount("");
      setNote("");
      setCurrency('HKD'); // Reset to HKD
      setCustomCurrency(''); // Clear custom currency
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

  // 6. 編輯支出 (Edit Expense)
  const handleEdit = (expense: NonNullable<typeof data>['expenses'][0]) => {
    if (!data) return;
    setEditingExpenseId(expense.id);

    // 填入基本資訊
    setCategory(expense.category || 'dining');
    setDate(expense.date);
    setNote(expense.note || '');

    // 填入金額和幣種
    const originalAmount = expense.originalAmount || expense.amountHKD;
    const originalCurrency = expense.originalCurrency || 'HKD';
    setAmount(originalAmount.toString());

    // Check if currency is in predefined list
    const isPredefinedCurrency = CURRENCIES.some(c => c.code === originalCurrency);
    if (isPredefinedCurrency) {
      setCurrency(originalCurrency);
      setCustomCurrency('');
    } else {
      setCurrency('OTHER');
      setCustomCurrency(originalCurrency);
    }

    // 填入付款人
    setPayerId(expense.payerId);

    // 解析參與者
    const participantIdList = expense.participants.map(p =>
      typeof p === 'string' ? p : p.id
    );
    setParticipantIds(participantIdList);

    // 檢查是否有自訂分擔
    const hasCustomSplits = expense.participants.some(p =>
      typeof p === 'object' && p.customAmount !== undefined
    );

    if (hasCustomSplits) {
      setSplitMode('custom');
      const splits: Record<string, string> = {};
      expense.participants.forEach(p => {
        if (typeof p === 'object' && p.customAmount !== undefined) {
          splits[p.id] = p.customAmount.toString();
        }
      });
      setCustomSplits(splits);
    } else {
      setSplitMode('equal');
      setCustomSplits({});
    }

    // 滾動到表單頂部
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast("編輯模式");
  };

  // 7. 取消編輯 (Cancel Edit)
  const handleCancelEdit = () => {
    setEditingExpenseId(null);
    setAmount("");
    setNote("");
    setCurrency('HKD');
    setCustomCurrency(''); // Clear custom currency
    setSplitMode('equal');
    setCustomSplits({});
    if (data) {
      setParticipantIds(data.members.map(m => m.id));
    }
    showToast("已取消編輯");
  };

  // 8. 更新支出 (Update Expense)
  const handleUpdateExpense = async () => {
    if (!data || !editingExpenseId) return;

    // 驗證必填欄位
    if (!amount || !payerId || participantIds.length === 0) {
      showToast("資料不完整", "error");
      return;
    }

    const finalCurrency = getFinalCurrency();
    const amountValue = parseFloat(amount);

    // Validate exchange rate for non-HKD currencies
    if (finalCurrency !== 'HKD') {
      const rate = exchangeRates[finalCurrency];
      if (!rate || rate === 0) {
        showToast(`請先輸入 ${finalCurrency} 的匯率`, "error");
        return;
      }
    }

    const amountHKD = finalCurrency === 'HKD'
      ? amountValue
      : amountValue * (exchangeRates[finalCurrency] || 0);

    // 驗證自訂分擔
    if (splitMode === 'custom') {
      const splitTotal = Object.values(customSplits)
        .reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
      const diff = Math.abs(amountHKD - splitTotal);

      if (diff > 1) {
        showToast(`分擔金額總和不正確 (差額: $${diff.toFixed(2)})`, "error");
        return;
      }

      const hasEmptySplits = participantIds.some(pid =>
        !customSplits[pid] || parseFloat(customSplits[pid]) === 0
      );
      if (hasEmptySplits) {
        showToast("請輸入所有參與者的分擔金額", "error");
        return;
      }
    }

    try {
      await updateExpense({
        code: data.code,
        expenseId: editingExpenseId,
        title: CATEGORIES.find((c) => c.id === category)?.label ?? "其他",
        category,
        note: note || undefined,
        date,
        payerId,
        participantIds,
        amountHKD,
        originalCurrency: finalCurrency,
        originalAmount: amountValue,
        customSplits: splitMode === 'custom' ? customSplits : undefined,
      });

      handleCancelEdit();
      await reloadTrip();
      showToast("已更新記錄");
    } catch (e) {
      console.error(e);
      showToast("更新失敗", "error");
    }
  };

  // 9. 刪除當前編輯中的支出 (Delete Current Editing Expense)
  const handleDeleteCurrentExpense = async () => {
    if (!data || !editingExpenseId) return;

    // Find the expense to show details in confirmation
    const expense = data.expenses.find(e => e.id === editingExpenseId);
    if (!expense) return;

    const confirmMsg = [
      '確定刪除此記錄?',
      '',
      `📝 ${expense.title}`,
      `💰 HKD $${expense.amountHKD.toFixed(2)}`,
      `📅 ${expense.date}`,
      `👤 ${expense.payerName}`,
    ].join('\n');

    if (!confirm(confirmMsg)) return;

    try {
      await deleteExpense(data.code, editingExpenseId);
      handleCancelEdit();
      await reloadTrip();
      showToast("已刪除", "success");
    } catch (e) {
      console.error(e);
      showToast("刪除失敗", "error");
    }
  };

  // 10. 匯出 CSV (Export CSV)
  const handleExportCSV = () => {
    if (!data || data.expenses.length === 0) {
      showToast("沒有記錄可匯出", "error");
      return;
    }

    // CSV Header
    const headers = [
      '日期',
      '類別',
      '標題',
      '付款人',
      '金額 (HKD)',
      '原始幣種',
      '原始金額',
      '分擔者',
      '備註',
    ];

    // CSV Rows
    const rows = data.expenses.map(e => {
      // Build participants text
      const allParticipants = e.participants.length === data.members.length;
      const participantsText = allParticipants
        ? "全員"
        : e.participants.map(p => {
            const memberId = typeof p === 'string' ? p : p.id;
            const member = data.members.find(m => m.id === memberId);
            const name = member?.name || '';

            // Include custom split amount if exists
            if (typeof p === 'object' && p.customAmount) {
              return `${name} ($${p.customAmount.toFixed(2)})`;
            }
            return name;
          }).filter(Boolean).join(', ');

      return [
        e.date,
        e.category || '其他',
        e.title,
        e.payerName,
        e.amountHKD.toFixed(2),
        e.originalCurrency || 'HKD',
        e.originalAmount?.toFixed(2) || e.amountHKD.toFixed(2),
        participantsText,
        (e.note || '').replace(/"/g, '""'), // Escape double quotes
      ];
    });

    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row =>
        row.map(cell => `"${cell}"`).join(',')
      ),
    ].join('\n');

    // Add BOM for Excel UTF-8 compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], {
      type: 'text/csv;charset=utf-8;'
    });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${data.name}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast("CSV 已匯出", "success");
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

  // 日期分組 (Group expenses by date)
  const expensesByDate = useMemo(() => {
    if (!data) return [];

    // Group expenses by date
    const groups = data.expenses.reduce((acc, expense) => {
      const date = expense.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(expense);
      return acc;
    }, {} as Record<string, typeof data.expenses>);

    // Convert to array and sort by date (newest first)
    const sortedGroups = Object.entries(groups)
      .map(([date, expenses]) => ({
        date,
        expenses,
        total: expenses.reduce((sum, e) => sum + e.amountHKD, 0),
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return sortedGroups;
  }, [data]);

  // Auto-expand the most recent date on initial load
  useEffect(() => {
    if (expensesByDate.length > 0 && expandedDates.size === 0) {
      setExpandedDates(new Set([expensesByDate[0].date]));
    }
  }, [expensesByDate, expandedDates.size]);

  // Toggle date expansion
  const toggleDateExpansion = (date: string) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  };

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
      <Toaster
        position="bottom-center"
        theme="dark"
        richColors
        expand={false}
      />
      <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="mb-6">
            {/* First Row - Buttons */}
            <div className="flex justify-between items-center mb-4">
              <button
                onClick={() => setShowFavoritesModal(true)}
                className="text-xs px-3 py-2 bg-[#1c1c1e] rounded-lg text-gray-400 border border-gray-800 hover:bg-gray-800 transition-colors"
                title="如何收藏此 App"
              >
                ⭐ 收藏
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleExportCSV}
                  className="text-xs px-3 py-2 bg-[#1c1c1e] rounded-lg text-gray-400 border border-gray-800 hover:bg-gray-800 transition-colors"
                  title="匯出為 CSV 文件"
                >
                  📊 匯出
                </button>
                <button
                  onClick={handleShareLink}
                  className="text-xs px-3 py-2 bg-[#1c1c1e] rounded-lg text-gray-400 border border-gray-800 hover:bg-gray-800 transition-colors"
                >
                  🔗 分享
                </button>
                <button
                  onClick={() => router.push('/expenses')}
                  className="text-xs px-3 py-2 bg-[#1c1c1e] rounded-lg text-gray-400 border border-gray-800 hover:bg-gray-800 transition-colors"
                >
                  ➕ 新旅程
                </button>
              </div>
            </div>
            {/* Second Row - Title */}
            <h1 className="text-2xl font-bold">{data.name}</h1>
          </div>

          {/* Favorites Modal */}
          {showFavoritesModal && (
            <div
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
              onClick={() => setShowFavoritesModal(false)}
            >
              <div
                className="bg-[#1c1c1e] rounded-2xl p-6 max-w-md w-full border border-gray-800"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-xl font-bold mb-4">⭐ 如何收藏此 App？</h2>
                <div className="space-y-4 text-sm text-gray-300">
                  <div>
                    <div className="font-semibold text-white mb-2">📱 iOS（推薦）：</div>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>點擊下方「分享」按鈕 <span className="text-blue-400">(↑)</span></li>
                      <li>選擇「加入主畫面」</li>
                      <li>或選擇「加入我的最愛」</li>
                    </ol>
                  </div>
                  <div>
                    <div className="font-semibold text-white mb-2">🤖 Android：</div>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>點擊瀏覽器選單 <span className="text-blue-400">(⋮)</span></li>
                      <li>選擇「安裝應用程式」或「加到主螢幕」</li>
                    </ol>
                  </div>
                </div>
                <button
                  onClick={() => setShowFavoritesModal(false)}
                  className="w-full mt-6 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-colors"
                >
                  知道了
                </button>
              </div>
            </div>
          )}

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

             {/* Currency Selector */}
             <div className="space-y-2">
               <div className="flex items-center gap-2">
                 <span className="text-xs text-gray-500 whitespace-nowrap">幣別:</span>
                 <select
                   value={currency}
                   onChange={(e) => {
                     const newCurrency = e.target.value;
                     setCurrency(newCurrency);
                     if (newCurrency === 'OTHER') {
                       setCustomCurrency('');
                     }
                   }}
                   className="flex-1 px-3 py-2 bg-black rounded-xl border border-gray-800 text-sm focus:border-blue-600 focus:outline-none"
                 >
                   {CURRENCIES.map(c => (
                     <option key={c.code} value={c.code}>
                       {c.flag} {c.label}
                     </option>
                   ))}
                 </select>
               </div>

               {/* Custom Currency Input */}
               {currency === 'OTHER' && (
                 <input
                   type="text"
                   placeholder="輸入幣種代碼 (如: SGD, MYR)"
                   value={customCurrency}
                   onChange={(e) => setCustomCurrency(e.target.value.toUpperCase())}
                   className="w-full p-3 bg-black rounded-xl border border-gray-800 text-sm placeholder:text-gray-600"
                   maxLength={5}
                 />
               )}

               {/* Exchange Rate Input (shown for non-HKD currencies) */}
               {((currency !== 'HKD' && currency !== 'OTHER') ||
                 (currency === 'OTHER' && customCurrency.trim())) && (
                 <div className="flex items-center gap-2 bg-black px-3 py-2 rounded-xl border border-gray-800">
                   <span className="text-xs text-gray-400 whitespace-nowrap">
                     匯率 ({getFinalCurrency()} → HKD):
                   </span>
                   <input
                     type="number"
                     step="0.000001"
                     placeholder="0.000000"
                     value={exchangeRates[getFinalCurrency()] || ''}
                     onChange={(e) => {
                       const code = getFinalCurrency();
                       setExchangeRates(prev => ({
                         ...prev,
                         [code]: parseFloat(e.target.value) || 0,
                       }));
                     }}
                     className="flex-1 p-2 bg-[#1c1c1e] rounded-lg border border-gray-700 text-sm focus:border-blue-600 focus:outline-none"
                   />
                 </div>
               )}
             </div>

             {/* Date and Amount Input */}
             <div className="flex gap-2">
               <input
                 type="date"
                 value={date}
                 onChange={(e) => setDate(e.target.value)}
                 className="w-1/3 p-3 h-12 bg-black rounded-xl border border-gray-800 focus:border-blue-600 focus:outline-none"
               />
               <div className="flex-1 min-w-0">
                 <input
                   type="number"
                   step="0.01"
                   placeholder={`金額 (${getFinalCurrency()})`}
                   value={amount}
                   onChange={(e) => setAmount(e.target.value)}
                   className="w-full p-3 h-12 bg-black rounded-xl border border-gray-800 font-bold focus:border-blue-600 focus:outline-none"
                 />
                 {getFinalCurrency() !== 'HKD' && amount && calculateHKD() > 0 && (
                   <div className="text-xs text-gray-500 mt-1 px-1">
                     ≈ HKD {calculateHKD().toFixed(2)}
                   </div>
                 )}
               </div>
             </div>

             {/* Note Input */}
             <input
               type="text"
               placeholder="備註 (選填)"
               value={note}
               onChange={(e) => setNote(e.target.value)}
               className="w-full p-3 h-12 bg-black rounded-xl border border-gray-800 focus:border-blue-600 focus:outline-none"
             />

             <div className="space-y-3">
                {/* 誰付錢 - Avatar Style */}
                <div className="space-y-2">
                  <span className="text-xs text-gray-500">誰付錢:</span>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {data.members.map((m, idx) => (
                      <button
                        key={m.id}
                        onClick={() => setPayerId(m.id)}
                        className={`relative flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                          payerId === m.id
                            ? 'border-white scale-110 shadow-lg shadow-blue-500/50'
                            : 'border-gray-700 opacity-60 hover:opacity-100 hover:scale-105'
                        }`}
                        style={{
                          backgroundColor: getAvatarColor(idx),
                        }}
                        title={m.name}
                      >
                        {getAvatarText(m.name)}
                        {payerId === m.id && (
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-black flex items-center justify-center text-xs">
                            ✓
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 誰分擔 - Avatar Style with 全選/全不選 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">誰分擔:</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setParticipantIds(data.members.map(m => m.id))}
                        className="text-xs px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors font-medium"
                      >
                        全選
                      </button>
                      <button
                        onClick={() => setParticipantIds([])}
                        className="text-xs px-3 py-1 bg-gray-700/50 text-gray-400 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                      >
                        全不選
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {data.members.map((m, idx) => {
                      const isSelected = participantIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => setParticipantIds(prev =>
                            prev.includes(m.id)
                              ? prev.filter(p => p !== m.id)
                              : [...prev, m.id]
                          )}
                          className={`relative flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                            isSelected
                              ? 'border-blue-500 opacity-100 scale-100'
                              : 'border-gray-700 opacity-30 hover:opacity-60'
                          }`}
                          style={{
                            backgroundColor: getAvatarColor(idx),
                          }}
                          title={m.name}
                        >
                          {getAvatarText(m.name)}
                          {isSelected && (
                            <div className="absolute inset-0 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg">
                              ✓
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
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
                      const total = calculateHKD();
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

             {editingExpenseId ? (
               <div className="space-y-2">
                 <button
                   onClick={handleUpdateExpense}
                   className="w-full py-3 bg-green-600 rounded-xl font-bold hover:bg-green-500 transition-colors"
                 >
                   💾 更新記錄
                 </button>
                 <div className="flex gap-2">
                   <button
                     onClick={handleCancelEdit}
                     className="flex-1 py-3 bg-gray-700 rounded-xl font-bold hover:bg-gray-600 transition-colors"
                   >
                     取消
                   </button>
                   <button
                     onClick={handleDeleteCurrentExpense}
                     className="flex-1 py-3 bg-red-600 rounded-xl font-bold hover:bg-red-500 transition-colors"
                   >
                     🗑️ 刪除
                   </button>
                 </div>
               </div>
             ) : (
               <button onClick={handleAddExpense} className="w-full py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-colors">
                 新增記錄
               </button>
             )}
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

          {/* Records List - Grouped by Date */}
          <div className="bg-[#1c1c1e] rounded-3xl border border-gray-800 overflow-hidden mb-4">
            <div className="p-4">
              <h3 className="font-bold text-gray-300 mb-4">記錄列表</h3>

              {expensesByDate.length === 0 && (
                <div className="text-center text-gray-500 py-8">暫無記錄</div>
              )}

              {/* Date Cards */}
              <div className="space-y-3">
                {expensesByDate.map((dateGroup) => {
                  const isExpanded = expandedDates.has(dateGroup.date);

                  return (
                    <div key={dateGroup.date} className="border border-gray-800 rounded-xl overflow-hidden">
                      {/* Date Header Card */}
                      <button
                        onClick={() => toggleDateExpansion(dateGroup.date)}
                        className="w-full p-4 bg-black hover:bg-gray-900 transition-colors flex justify-between items-center"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">{isExpanded ? "📅" : "📆"}</div>
                          <div className="text-left">
                            <div className="font-bold text-white">{formatDate(dateGroup.date)}</div>
                            <div className="text-xs text-gray-400">{dateGroup.expenses.length} 筆記錄</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-white">HKD ${dateGroup.total.toFixed(2)}</div>
                          <div className="text-xs text-gray-500">{isExpanded ? "▲" : "▼"}</div>
                        </div>
                      </button>

                      {/* Expanded Records */}
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-2 bg-black/30">
                          {dateGroup.expenses.map((e) => {
                            // Calculate beneficiaries display
                            const allParticipants = e.participants.length === data.members.length;
                            const beneficiariesText = allParticipants
                              ? "全員"
                              : e.participants.map(p => {
                                  const memberId = typeof p === 'string' ? p : p.id;
                                  return data.members.find(m => m.id === memberId)?.name;
                                }).filter(Boolean).join(", ");

                            return (
                              <div key={e.id} className="flex justify-between items-center bg-[#1c1c1e] p-3 rounded-xl border border-gray-800">
                                <div className="flex items-center gap-3 flex-1">
                                  <div className="text-xl">{CATEGORIES.find(c => c.id === e.category)?.icon || "📝"}</div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm">{e.title}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      {data.members.find(m => m.id === e.payerId)?.name} 付款 • {beneficiariesText}
                                      {e.originalCurrency && e.originalCurrency !== 'HKD' && e.originalAmount && (
                                        <span className="ml-1 text-gray-600">(原本 {e.originalCurrency} {e.originalAmount.toFixed(0)})</span>
                                      )}
                                    </div>
                                    {e.note && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        <span className="opacity-70">📝</span> {e.note}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right flex items-center gap-2">
                                  <div className="font-bold text-sm">${e.amountHKD.toFixed(1)}</div>
                                  <button
                                    onClick={() => handleEdit(e)}
                                    className="text-lg p-2 hover:bg-blue-500/20 rounded-lg transition-colors"
                                    title="編輯"
                                  >
                                    ✏️
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
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
