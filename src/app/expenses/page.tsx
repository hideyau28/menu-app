"use client";

import { Suspense, useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createTrip, getTripByCode, addExpense, deleteExpense, updateExpense, renameTrip } from "./actions";
import { toast, Toaster } from 'sonner';
import * as XLSX from 'xlsx';
import { Star, FileSpreadsheet, Share2, FolderPlus, RotateCw, ChevronDown, Check, Copy, Loader2, Trash2, ArrowRight, Calendar } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { enUS, zhTW } from 'date-fns/locale';

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
  { code: 'JPY', label: 'JPY', flag: '🇯🇵' },
  { code: 'USD', label: 'USD', flag: '🇺🇸' },
  { code: 'CNY', label: 'CNY', flag: '🇨🇳' },
  { code: 'EUR', label: 'EUR', flag: '🇪🇺' },
  { code: 'GBP', label: 'GBP', flag: '🇬🇧' },
  { code: 'CAD', label: 'CAD', flag: '🇨🇦' },
  { code: 'KRW', label: 'KRW', flag: '🇰🇷' },
  { code: 'TWD', label: 'TWD', flag: '🇹🇼' },
  { code: 'THB', label: 'THB', flag: '🇹🇭' },
  { code: 'AUD', label: 'AUD', flag: '🇦🇺' },
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

const TOAST_STYLE = {
  success: { background: '#10b981', color: 'white', border: 'none' },
  error: { background: '#ef4444', color: 'white', border: 'none' },
} as const;
const TOAST_DURATION = { success: 2000, error: 3000 } as const;

const MEMBER_NAME_EXAMPLES = ['阿明', 'Alex', '阿May', '小強', '阿珍', '阿東', 'Kelly', '阿傑'];

const getAvatarText = (name: string) => {
  if (!name) return '?';

  // Check if the first character is ASCII (English/Latin)
  const firstChar = name.charAt(0);
  const isAscii = firstChar.charCodeAt(0) < 128;

  if (isAscii) {
    // For ASCII/English names, take the first 2 letters and uppercase
    return name.slice(0, 2).toUpperCase();
  } else {
    // For Chinese/other names, take the first character
    return name.slice(0, 1);
  }
};

function TripLoader() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <div className="mb-4 text-6xl animate-bounce">✈️</div>
        <div className="text-lg font-bold mb-2">旅程記帳</div>
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '0.2s' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    </div>
  );
}

function ExpensesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const { language, setLanguage, t } = useTranslation();

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
  const [exchangeRates, setExchangeRates] = useState<Record<string, string>>({});
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});

  // Editing State
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // UI States
  const [submitting, setSubmitting] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [recentTrips, setRecentTrips] = useState<Array<{ code: string; name: string; date: string }>>([]);
  const [fetchingRate, setFetchingRate] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Accordion States
  const [balancesExpanded, setBalancesExpanded] = useState(false);
  const [settlementsExpanded, setSettlementsExpanded] = useState(false);
  const [recordsExpanded, setRecordsExpanded] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [editFlash, setEditFlash] = useState(false);
  const [paidSettlements, setPaidSettlements] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [nameEditing, setNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  // Modal States
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Date Grouping State - Multiple dates can be expanded at the same time
  const [expandedDates, setExpandedDates] = useState<string[]>([]);

  // Toast Helper using Sonner
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    const fn = type === "success" ? toast.success : toast.error;
    fn(msg, { duration: TOAST_DURATION[type], style: TOAST_STYLE[type] });
  };

  // Share Link Handler
  const handleShareLink = async () => {
    if (typeof window !== "undefined") {
      // Try Web Share API first (mobile)
      if (navigator.share) {
        try {
          await navigator.share({
            title: data?.name || '旅程記帳',
            text: '一起來記帳吧！by @midlife_ai_hk',
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
          showToast("搵唔到呢個旅程，請重新建立", "error");
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
      const savedRates = localStorage.getItem('tripUtility_exchangeRates');
      if (savedRates) {
        try {
          setExchangeRates(JSON.parse(savedRates));
        } catch (e) {
          console.error('Failed to parse exchange rates:', e);
        }
      }
      // #9: Load recent trips
      const saved = localStorage.getItem('tripUtility_recentTrips');
      if (saved) {
        try { setRecentTrips(JSON.parse(saved)); } catch {}
      }
    }
  }, []);

  // #9: Save current trip to recent trips list (also re-syncs on rename via data.name dep)
  useEffect(() => {
    if (data && typeof window !== 'undefined') {
      // Local date (en-CA gives YYYY-MM-DD format in local timezone)
      const entry = { code: data.code, name: data.name, date: new Date().toLocaleDateString('en-CA') };
      setRecentTrips(prev => {
        const filtered = prev.filter(t => t.code !== data.code);
        const updated = [entry, ...filtered].slice(0, 10);
        try {
          localStorage.setItem('tripUtility_recentTrips', JSON.stringify(updated));
        } catch {
          // ignore (private mode / quota)
        }
        return updated;
      });
    }
  }, [data?.code, data?.name]);

  // Load paid-settlements set per trip
  useEffect(() => {
    if (!data?.code || typeof window === 'undefined') return;
    const saved = localStorage.getItem(`tripUtility_paidSettlements_${data.code}`);
    if (saved) {
      try { setPaidSettlements(new Set(JSON.parse(saved))); } catch { setPaidSettlements(new Set()); }
    } else {
      setPaidSettlements(new Set());
    }
  }, [data?.code]);

  // Save exchange rates to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && Object.keys(exchangeRates).length > 0) {
      try {
        localStorage.setItem('tripUtility_exchangeRates', JSON.stringify(exchangeRates));
      } catch {
        // ignore (private mode / quota)
      }
    }
  }, [exchangeRates]);

  // Reset custom splits when participants change or split mode changes
  // Fix #2: Use functional update to avoid stale closure
  useEffect(() => {
    if (splitMode === 'custom' && participantIds.length > 0) {
      setCustomSplits(prev => {
        const newSplits: Record<string, string> = {};
        participantIds.forEach(id => {
          newSplits[id] = prev[id] || '';
        });
        return newSplits;
      });
    }
  }, [participantIds, splitMode]);

  // Esc cancels edit mode
  useEffect(() => {
    if (editingExpenseId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancelEdit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // handleCancelEdit reads latest state via closure recreated each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingExpenseId]);

  // Auto-open advanced (date+note) disclosure + flash form ring when entering edit mode
  useEffect(() => {
    if (editingExpenseId !== null) {
      setAdvancedOpen(true);
      setEditFlash(true);
      const t = setTimeout(() => setEditFlash(false), 800);
      return () => clearTimeout(t);
    }
  }, [editingExpenseId]);

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
  // Fix #10: Added input sanitization
  const handleCreateTrip = async () => {
    const trimmedName = tripName.trim();
    const members = memberNames.map((n) => n.trim()).filter(Boolean);

    if (!trimmedName || members.length < 2) {
      showToast("請輸入旅程名稱，最少要 2 位成員", "error");
      return;
    }

    if (trimmedName.length > 50) {
      showToast("旅程名稱最多 50 字", "error");
      return;
    }

    if (members.some(m => m.length > 20)) {
      showToast("成員名稱最多 20 字", "error");
      return;
    }

    try {
      setSubmitting(true);
      setLoading(true);
      const res = await createTrip(trimmedName, members);
      // 成功後直接跳轉，不需要存 localStorage，因為跳轉後的 URL 包含 code，會觸發上面的 useEffect
      router.replace(`/expenses?code=${res.code}`);
    } catch (e) {
      showToast("建立失敗，請檢查網絡", "error");
      setLoading(false);
      setSubmitting(false);
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

    const rate = parseFloat(exchangeRates[finalCurrency] || '0');
    return parseFloat(amount) * rate;
  };

  // 4. 新增支出 (Add Expense)
  const handleAddExpense = async () => {
    if (!data) return;
    if (!amount || !payerId || participantIds.length === 0) {
      showToast(t.errMissingFields, "error");
      return;
    }

    const finalCurrency = getFinalCurrency();
    const amountValue = parseFloat(amount);

    // Fix #3: Validate NaN and non-positive amounts
    if (isNaN(amountValue) || amountValue <= 0) {
      showToast(t.errInvalidAmount, "error");
      return;
    }

    // Validate exchange rate for non-HKD currencies
    if (finalCurrency !== 'HKD') {
      const rate = parseFloat(exchangeRates[finalCurrency] || '0');
      if (!rate || rate === 0) {
        showToast(t.errEnterRate(finalCurrency), "error");
        return;
      }
    }

    const amountHKD = finalCurrency === 'HKD'
      ? amountValue
      : amountValue * parseFloat(exchangeRates[finalCurrency] || '0');

    // Validate custom splits
    if (splitMode === 'custom') {
      // Reject negative amounts
      const hasNegative = participantIds.some(pid => parseFloat(customSplits[pid] || '0') < 0);
      if (hasNegative) {
        showToast(t.errSplitNegative, "error");
        return;
      }

      const splitTotal = Object.values(customSplits)
        .reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
      const diff = Math.abs(amountHKD - splitTotal);

      if (diff > 1) {
        showToast(t.errSplitMismatch(diff.toFixed(1)), "error");
        return;
      }

      // Check all participants have amounts
      const hasEmptySplits = participantIds.some(pid => !customSplits[pid] || parseFloat(customSplits[pid]) === 0);
      if (hasEmptySplits) {
        showToast(t.errSplitEmpty, "error");
        return;
      }
    }

    try {
      setSubmitting(true);
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

      // #2: Auto-expand the date of the newly added expense
      setExpandedDates(prev => prev.includes(date) ? prev : [...prev, date]);

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
    } finally {
      setSubmitting(false);
    }
  };

  // 5. 刪除支出 (Delete Expense) - Fix #9: Use custom modal
  const handleDelete = (expenseId: string) => {
    if (!data) return;
    setConfirmModal({
      message: "確定刪除此記錄？",
      onConfirm: async () => {
        try {
          await deleteExpense(data.code, expenseId);
          await reloadTrip();
          showToast("已刪除");
        } catch (e) {
          showToast("刪除失敗", "error");
        }
      },
    });
  };

  // 6. 編輯支出 (Edit Expense)
  const handleEdit = (expense: NonNullable<typeof data>['expenses'][0]) => {
    if (!data) return;
    setEditingExpenseId(expense.id);
    // Clear any active category filter so user sees the edited record after save
    setCategoryFilter(null);

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
      showToast(t.errMissingFields, "error");
      return;
    }

    const finalCurrency = getFinalCurrency();
    const amountValue = parseFloat(amount);

    // Fix #3: Validate NaN and non-positive amounts
    if (isNaN(amountValue) || amountValue <= 0) {
      showToast(t.errInvalidAmount, "error");
      return;
    }

    // Validate exchange rate for non-HKD currencies
    if (finalCurrency !== 'HKD') {
      const rate = parseFloat(exchangeRates[finalCurrency] || '0');
      if (!rate || rate === 0) {
        showToast(t.errEnterRate(finalCurrency), "error");
        return;
      }
    }

    const amountHKD = finalCurrency === 'HKD'
      ? amountValue
      : amountValue * parseFloat(exchangeRates[finalCurrency] || '0');

    // 驗證自訂分擔
    if (splitMode === 'custom') {
      const hasNegative = participantIds.some(pid => parseFloat(customSplits[pid] || '0') < 0);
      if (hasNegative) {
        showToast(t.errSplitNegative, "error");
        return;
      }

      const splitTotal = Object.values(customSplits)
        .reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
      const diff = Math.abs(amountHKD - splitTotal);

      if (diff > 1) {
        showToast(t.errSplitMismatch(diff.toFixed(1)), "error");
        return;
      }

      const hasEmptySplits = participantIds.some(pid =>
        !customSplits[pid] || parseFloat(customSplits[pid]) === 0
      );
      if (hasEmptySplits) {
        showToast(t.errSplitEmpty, "error");
        return;
      }
    }

    try {
      setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  };

  // 10. 匯出 Excel (Export Excel with 3 Sheets)
  const handleExportExcel = () => {
    if (!data || data.expenses.length === 0) {
      showToast("沒有記錄可匯出", "error");
      return;
    }

    try {
      // Sheet 1: 交易紀錄 (Transactions)
      const transactionHeaders = [
        '日期',
        '種類',
        '備註',
        '貨幣',
        '原幣金額',
        '折算港幣(HKD)',
        '付款人',
        ...data.members.map(m => m.name), // Dynamic member columns
      ];

      const transactionRows = data.expenses.map(e => {
        const row: any[] = [
          e.date,
          CATEGORIES.find(c => c.id === e.category)?.label || '其他',
          e.note || '',
          e.originalCurrency || 'HKD',
          e.originalAmount || e.amountHKD,
          e.amountHKD,
          e.payerName,
        ];

        // Add split amounts for each member
        data.members.forEach(member => {
          const participant = e.participants.find(p => {
            const memberId = typeof p === 'string' ? p : p.id;
            return memberId === member.id;
          });

          if (participant) {
            // Check if custom split exists
            const customAmount = typeof participant === 'object' ? participant.customAmount : undefined;
            const share = customAmount !== undefined
              ? customAmount
              : e.amountHKD / e.participants.length;
            row.push(share);
          } else {
            row.push(0);
          }
        });

        return row;
      });

      const ws1 = XLSX.utils.aoa_to_sheet([transactionHeaders, ...transactionRows]);

      // Sheet 2: 結餘狀況 (Balances)
      const balanceHeaders = ['姓名', '代墊金額 (Paid)', '消費金額 (Share)', '淨結餘 (Balance)'];
      const balanceRows = data.members.map(member => {
        // Calculate total paid
        const totalPaid = data.expenses
          .filter(e => e.payerId === member.id)
          .reduce((sum, e) => sum + e.amountHKD, 0);

        // Calculate total share
        const totalShare = data.expenses
          .filter(e => e.participants.some(p => {
            const memberId = typeof p === 'string' ? p : p.id;
            return memberId === member.id;
          }))
          .reduce((sum, e) => {
            const participant = e.participants.find(p => {
              const memberId = typeof p === 'string' ? p : p.id;
              return memberId === member.id;
            });

            if (!participant) return sum;

            const customAmount = typeof participant === 'object' ? participant.customAmount : undefined;
            const share = customAmount !== undefined
              ? customAmount
              : e.amountHKD / e.participants.length;

            return sum + share;
          }, 0);

        const balance = totalPaid - totalShare;

        return [member.name, totalPaid, totalShare, balance];
      });

      const ws2 = XLSX.utils.aoa_to_sheet([balanceHeaders, ...balanceRows]);

      // Sheet 3: 建議還款 (Repayments)
      const repaymentHeaders = ['付款人 (From)', '收款人 (To)', '金額 (HKD)'];
      const repaymentRows = settlements.map(s => [s.from, s.to, s.amount]);

      const ws3 = XLSX.utils.aoa_to_sheet([repaymentHeaders, ...repaymentRows]);

      // Create workbook and add sheets
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, '交易紀錄');
      XLSX.utils.book_append_sheet(wb, ws2, '結餘狀況');
      XLSX.utils.book_append_sheet(wb, ws3, '建議還款');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `${data.name}_Report_${timestamp}.xlsx`;

      // Write file
      XLSX.writeFile(wb, filename);

      showToast("已匯出 Excel · 請睇下載資料夾", "success");
    } catch (error) {
      console.error('Export error:', error);
      showToast("匯出失敗", "error");
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

  // 日期分組 (Group expenses by date, with optional category filter for display)
  const expensesByDate = useMemo(() => {
    if (!data) return [];

    const filtered = categoryFilter
      ? data.expenses.filter(e => e.category === categoryFilter)
      : data.expenses;

    // Group expenses by date
    const groups = filtered.reduce((acc, expense) => {
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
  }, [data, categoryFilter]);

  // Multi-date expansion enabled - users can expand multiple dates simultaneously
  // No auto-expand logic to allow full collapse

  // Format date for display - Localized
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, language === 'en' ? 'MMM d' : 'M月d日', {
      locale: language === 'en' ? enUS : zhTW
    });
  };

  // #10: Auto-fetch exchange rate
  const fetchExchangeRate = async (currencyCode: string) => {
    if (!currencyCode || currencyCode === 'HKD' || currencyCode === 'OTHER') return;
    setFetchingRate(true);
    try {
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${currencyCode}`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const rate = data.rates?.HKD;
      if (rate) {
        setExchangeRates(prev => ({ ...prev, [currencyCode]: rate.toString() }));
        showToast(`已取得 ${currencyCode} → HKD 匯率`);
      } else {
        showToast("找不到匯率", "error");
      }
    } catch {
      showToast("匯率獲取失敗，請手動輸入", "error");
    } finally {
      setFetchingRate(false);
    }
  };

  // #1: Join trip by code
  const handleJoinTrip = () => {
    const trimmed = joinCode.trim().toUpperCase();
    if (!trimmed) {
      showToast("請輸入旅程碼", "error");
      return;
    }
    router.push(`/expenses?code=${trimmed}`);
  };

  // --- 畫面渲染邏輯 ---

  // 情況 A: 正在跟 Server 拿資料
  if (loading) {
    return <TripLoader />;
  }

  // 情況 B: 有 code 但找不到資料 -> 顯示錯誤 (Force English)
  if (code && !data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center px-4">
            <div className="mb-4 flex justify-center">
              <RotateCw className="w-12 h-12 text-blue-500" />
            </div>
            <div className="text-sm text-gray-400 mb-6">Code: {code}</div>
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-blue-600 rounded-xl hover:bg-blue-500 transition-colors font-medium"
            >
                Refresh Page
            </button>
            <button
              onClick={() => router.push('/expenses')}
              className="mt-4 px-8 py-3 border border-gray-600 text-gray-400 rounded-xl hover:bg-gray-800 hover:scale-105 active:scale-95 transition-all block w-full max-w-xs mx-auto"
            >
                Create New Trip
            </button>
        </div>
      </div>
    );
  }

  // 情況 C: 沒有 code -> 顯示「建立新旅程」
  if (!code) {
    return (
      <div className="min-h-screen bg-black p-4 pt-12 text-white pb-20 relative overflow-hidden">
        {/* Background decorative orbs */}
        <div className="fixed top-20 -left-20 w-60 h-60 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
        />
        <div className="fixed bottom-20 -right-20 w-60 h-60 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }}
        />
        <Toaster position="bottom-center" theme="dark" richColors expand={false} />
        <div className="max-w-md mx-auto relative">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="text-6xl mb-3" style={{ filter: 'drop-shadow(0 0 20px rgba(59,130,246,0.3))' }}>✈️</div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">旅程記帳</h1>
              <p className="text-gray-500 text-sm mt-2">輕鬆分帳，旅途無憂</p>
            </div>

            {/* #1: Join existing trip */}
            <div className="bg-[#1c1c1e] rounded-2xl p-4 mb-6 border border-gray-800">
              <div className="text-sm text-gray-400 mb-2">🔗 加入旅程</div>
              <div className="flex gap-2">
                <input
                  className="flex-1 p-3 bg-black rounded-xl border border-gray-700 text-center tracking-widest uppercase font-mono"
                  placeholder="輸入旅程碼"
                  aria-label="旅程碼"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinTrip()}
                />
                <button
                  onClick={handleJoinTrip}
                  className="px-5 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-colors"
                >
                  加入
                </button>
              </div>
            </div>

            {/* #9: Recent trips */}
            {recentTrips.length > 0 && (
              <div className="mb-6">
                <div className="text-sm text-gray-400 mb-2">📋 最近旅程</div>
                <div className="space-y-2">
                  {recentTrips.map(trip => (
                    <div
                      key={trip.code}
                      className="flex items-center bg-[#1c1c1e] rounded-xl border border-gray-800 hover:bg-gray-800/80 transition-colors overflow-hidden"
                    >
                      <button
                        onClick={() => router.push(`/expenses?code=${trip.code}`)}
                        className="flex-1 min-w-0 flex items-center justify-between p-3 text-left"
                        aria-label={`開啟旅程 ${trip.name}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{trip.name}</div>
                          <div className="text-xs text-gray-500 font-mono">{trip.code}</div>
                        </div>
                        <div className="text-xs text-gray-400 flex-shrink-0 ml-2">{trip.date}</div>
                      </button>
                      <button
                        onClick={() => {
                          setRecentTrips(prev => {
                            const updated = prev.filter(t => t.code !== trip.code);
                            if (typeof window !== 'undefined') {
                              try {
                                localStorage.setItem('tripUtility_recentTrips', JSON.stringify(updated));
                              } catch {
                                // ignore (private mode / quota)
                              }
                            }
                            return updated;
                          });
                        }}
                        className="min-w-11 min-h-11 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                        aria-label={`移除 ${trip.name} 出最近旅程`}
                        title="移除"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 border-t border-gray-800" />
              <span className="text-gray-500 text-xs">或者建立新旅程</span>
              <div className="flex-1 border-t border-gray-800" />
            </div>

            <input
            className="w-full p-4 bg-[#1c1c1e] rounded-xl mb-4 border border-gray-800"
            placeholder="旅程名稱 (如: 東京之旅)"
            aria-label="旅程名稱"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
            />

            {/* #5: Member avatar preview */}
            {memberNames.some(n => n.trim()) && (
              <div className="flex gap-2 mb-3 px-1">
                {memberNames.filter(n => n.trim()).map((n, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: getAvatarColor(i) }}
                  >
                    {getAvatarText(n.trim())}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 mb-6">
                {memberNames.map((n, i) => (
                <div key={i} className="flex gap-2">
                    <input
                        className="flex-1 p-4 bg-[#1c1c1e] rounded-xl border border-gray-800"
                        placeholder={`成員 ${i + 1}（如：${MEMBER_NAME_EXAMPLES[i % MEMBER_NAME_EXAMPLES.length]}）`}
                        aria-label={`成員 ${i + 1} 名稱`}
                        value={n}
                        onChange={(e) => {
                        const next = [...memberNames];
                        next[i] = e.target.value;
                        setMemberNames(next);
                        }}
                    />
                    {memberNames.length > 2 && (
                        <button
                          onClick={() => setMemberNames(memberNames.filter((_, idx) => idx !== i))}
                          className="px-4 py-3 bg-[#1c1c1e] rounded-xl border border-gray-800 text-red-400"
                        >
                          ✕
                        </button>
                    )}
                </div>
                ))}
            </div>

            <div className="flex gap-2">
                <button onClick={() => setMemberNames([...memberNames, ""])} className="px-4 py-3 bg-[#1c1c1e] rounded-xl border border-gray-800 text-gray-400">
                    +
                </button>
                <button
                  onClick={handleCreateTrip}
                  disabled={submitting}
                  className="flex-1 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> 建立中...</> : '🚀 開始旅程'}
                </button>
            </div>

            {/* Footer Branding */}
            <div className="mt-10 text-center">
              <a
                href="https://www.instagram.com/midlife_ai_hk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                <span>Made by</span>
                <span className="font-medium">@midlife_ai_hk</span>
              </a>
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
    <div className="min-h-[101vh] bg-black p-4 pt-12 text-white pb-40">
      <Toaster
        position="bottom-center"
        theme="dark"
        richColors
        expand={false}
      />

      {/* Confirm Modal (#9) */}
      {confirmModal && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6"
          onClick={() => setConfirmModal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-[#2c2c2e] rounded-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mb-3">
                <Trash2 className="w-6 h-6 text-red-400" aria-hidden="true" />
              </div>
              <div className="text-base font-semibold">
                {confirmModal.message}
              </div>
              <div className="text-xs text-gray-400 mt-1">呢個動作冇得復原</div>
            </div>
            <div className="flex border-t border-gray-700">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-3 text-blue-400 font-medium border-r border-gray-700 active:bg-gray-700/50"
              >
                取消
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="flex-1 py-3 text-red-400 font-bold active:bg-gray-700/50"
              >
                確定刪除
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="mb-5">
            {/* Title with Language Toggle */}
            <div className="flex items-start gap-2 mb-2">
              {nameEditing ? (
                <input
                  type="text"
                  autoFocus
                  value={nameDraft}
                  disabled={nameSaving}
                  maxLength={50}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={async () => {
                    const trimmed = nameDraft.trim();
                    if (!trimmed || trimmed === data.name) {
                      setNameEditing(false);
                      return;
                    }
                    try {
                      setNameSaving(true);
                      await renameTrip(data.code, trimmed);
                      await reloadTrip();
                      showToast("已改旅程名");
                    } catch {
                      showToast("改名失敗", "error");
                    } finally {
                      setNameSaving(false);
                      setNameEditing(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                    if (e.key === 'Escape') { setNameEditing(false); }
                  }}
                  className="text-3xl font-extrabold tracking-tight flex-1 min-w-0 bg-transparent border-b-2 border-blue-500/60 focus:outline-none focus:border-blue-400 px-0 py-0"
                  aria-label="編輯旅程名稱"
                />
              ) : (
                <h1
                  className="text-3xl font-extrabold tracking-tight flex-1 min-w-0 break-words cursor-text hover:text-blue-100 transition-colors"
                  title={`${data.name} · 㩒一下改名`}
                  onClick={() => { setNameDraft(data.name); setNameEditing(true); }}
                >
                  {data.name}
                </h1>
              )}
              <button
                onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
                className="text-xs font-bold border border-gray-600 rounded-full px-3 py-1 hover:bg-gray-800 transition-colors flex-shrink-0 mt-1"
                aria-label={language === 'zh' ? '切換到英文' : '切換到中文'}
              >
                {language === 'zh' ? 'EN' : '中'}
              </button>
            </div>
            {/* Trip code chip with inline copy + share */}
            <div className="inline-flex items-center gap-1 bg-gray-900/60 border border-gray-800 rounded-full pl-3 pr-1 py-1">
              <span className="font-mono text-xs tracking-widest text-gray-300">{data.code}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(data.code)
                    .then(() => {
                      setCodeCopied(true);
                      showToast("旅程碼已複製");
                      setTimeout(() => setCodeCopied(false), 1500);
                    })
                    .catch(() => showToast("複製失敗，請手動 select", "error"));
                }}
                className={`ml-1 w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                  codeCopied
                    ? 'text-green-400 bg-green-500/15'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                aria-label="複製旅程碼"
                title="複製旅程碼"
              >
                {codeCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleShareLink}
                className="w-7 h-7 flex items-center justify-center rounded-full text-blue-300 hover:text-white hover:bg-blue-600/40 transition-colors"
                aria-label="分享旅程連結"
                title="分享連結"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            </div>
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

          {/* Total Card - Premium Gradient */}
          <div className="mb-6 p-6 rounded-3xl shadow-lg border border-gray-700/50 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            }}
          >
            {/* Subtle glow orb */}
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-20"
              style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
            />
            <div className="relative">
              <div className="text-blue-200 text-sm mb-1">{t.totalExpense}</div>
              <div className="text-4xl font-extrabold text-white tracking-tight">
                  <span className="text-blue-200/90 text-2xl mr-1">HKD</span>
                  {data.expenses.reduce((s, e) => s + e.amountHKD, 0).toLocaleString('en', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </div>
              {/* Per-person average + record count, or empty hint */}
              {data.members.length > 0 && data.expenses.length > 0 ? (
                <div className="flex items-center gap-2 mt-2 text-sm text-blue-100/90">
                  <span>人均 ${(data.expenses.reduce((s, e) => s + e.amountHKD, 0) / data.members.length).toFixed(1)}</span>
                  <span className="text-blue-200/40">·</span>
                  <span>{data.expenses.length} 筆記錄</span>
                </div>
              ) : (
                <div className="mt-2 text-sm text-blue-100/80">
                  ↓ 喺下面記低第一筆支出
                </div>
              )}

              {/* Rainbow Proportion Bar + Category Legend */}
              {data.expenses.length > 0 && (() => {
                const total = data.expenses.reduce((s, e) => s + e.amountHKD, 0);
                if (total === 0) return null;

                const categoryTotals = CATEGORIES.map(cat => ({
                  id: cat.id,
                  label: cat.label,
                  icon: cat.icon,
                  amount: data.expenses
                    .filter(e => e.category === cat.id)
                    .reduce((s, e) => s + e.amountHKD, 0),
                })).filter(c => c.amount > 0);

                if (categoryTotals.length === 0) return null;

                return (
                  <div className="mt-4">
                    <div className="flex h-2.5 rounded-full overflow-hidden mb-3">
                      {categoryTotals.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setCategoryFilter(prev => prev === cat.id ? null : cat.id)}
                          style={{
                            width: `${(cat.amount / total) * 100}%`,
                            backgroundColor: CATEGORY_COLORS[cat.id] || '#6b7280',
                            opacity: categoryFilter && categoryFilter !== cat.id ? 0.3 : 1,
                          }}
                          className="transition-all duration-300 hover:brightness-125"
                          aria-label={`篩選 ${cat.label} 類別`}
                          title={cat.label}
                        />
                      ))}
                    </div>
                    {/* Category Legend - clickable filter chips */}
                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                      {categoryTotals.map(cat => {
                        const isActive = categoryFilter === cat.id;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => setCategoryFilter(prev => prev === cat.id ? null : cat.id)}
                            aria-pressed={isActive}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                              isActive
                                ? 'bg-white/15 text-white'
                                : categoryFilter
                                  ? 'text-gray-500 hover:text-gray-300'
                                  : 'text-gray-300 hover:bg-white/5'
                            }`}
                          >
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat.id] }} />
                            <span>{cat.icon} {cat.label}</span>
                            <span className={isActive ? 'text-white/80' : 'text-gray-400'}>{((cat.amount / total) * 100).toFixed(0)}%</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Action Buttons Row - Secondary actions after total */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            <button
              onClick={handleExportExcel}
              className="h-11 flex items-center justify-center bg-gray-800/80 rounded-xl text-gray-300 hover:bg-gray-700 transition-all active:scale-95"
              aria-label="匯出為 Excel 文件"
              title="匯出 Excel"
            >
              <FileSpreadsheet className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={() => setShowFavoritesModal(true)}
              className="h-11 flex items-center justify-center bg-gray-800/80 rounded-xl text-gray-300 hover:bg-gray-700 transition-all active:scale-95"
              aria-label="如何收藏此 App 到主畫面"
              title="收藏 App"
            >
              <Star className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={() => router.push('/expenses')}
              className="h-11 flex items-center justify-center bg-gray-800/80 rounded-xl text-gray-300 hover:bg-gray-700 transition-all active:scale-95"
              aria-label="建立新旅程"
              title="新旅程"
            >
              <FolderPlus className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={() => window.location.reload()}
              className="h-11 flex items-center justify-center bg-gray-800/80 rounded-xl text-gray-300 hover:bg-gray-700 transition-all active:scale-95"
              aria-label="重新載入頁面"
              title="重新載入"
            >
              <RotateCw className="w-[18px] h-[18px]" />
            </button>
          </div>

          {/* Add Expense Form - Moved to top */}
          <div ref={formRef} className={`p-5 rounded-3xl border mb-8 space-y-4 transition-all duration-500 ${
            editingExpenseId
              ? `bg-[#1a1a2e] border-yellow-600/50 ${editFlash ? 'ring-4 ring-yellow-500/60' : 'ring-1 ring-yellow-600/30'}`
              : 'bg-[#1c1c1e] border-gray-800'
          }`}>
             {/* #3: Edit mode banner */}
             {editingExpenseId && (
               <div className="flex items-center justify-between bg-yellow-600/20 text-yellow-400 text-xs font-bold px-3 py-2 rounded-lg -mt-1">
                 <span>✏️ 編輯模式</span>
                 <button onClick={handleCancelEdit} className="text-gray-400 hover:text-white">✕ 取消</button>
               </div>
             )}
             <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((c) => {
                  const color = CATEGORY_COLORS[c.id] || '#6b7280';
                  const isSelected = category === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setCategory(c.id)}
                      aria-pressed={isSelected}
                      className={`h-[52px] p-2 rounded-xl border-2 transition-all text-white flex flex-col items-center justify-center active:scale-95 ${
                        isSelected
                          ? 'font-bold scale-105 shadow-md'
                          : 'hover:scale-105 hover:bg-white/5'
                      }`}
                      style={
                        isSelected
                          ? { borderColor: color, backgroundColor: color }
                          : { borderColor: color }
                      }
                    >
                      <span className="text-lg">{c.icon}</span>
                      <span className="text-[11px] leading-tight mt-1 px-1 text-center">
                        {(() => { const v = t[c.id as keyof typeof t]; return typeof v === 'string' ? v : c.label; })()}
                      </span>
                    </button>
                  );
                })}
             </div>

             {/* Currency + Amount (primary row) */}
             <div className="grid grid-cols-2 gap-3">
               <label className="contents">
                 <span className="sr-only">幣種</span>
                 <select
                   value={currency}
                   onChange={(e) => {
                     const newCurrency = e.target.value;
                     setCurrency(newCurrency);
                     if (newCurrency === 'OTHER') {
                       setCustomCurrency('');
                     }
                   }}
                   className="w-full px-3 h-[52px] bg-black rounded-xl border border-gray-800 focus:border-blue-600 focus:outline-none appearance-none text-center text-[15px] font-medium leading-normal placeholder:text-gray-500"
                   style={{
                     backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                     backgroundPosition: 'right 0.5rem center',
                     backgroundRepeat: 'no-repeat',
                     backgroundSize: '1.5em 1.5em',
                   }}
                 >
                   {CURRENCIES.map(c => (
                     <option key={c.code} value={c.code}>
                       {c.flag} {c.code} {language === 'zh' && c.code === 'HKD' ? '港幣' : ''}
                     </option>
                   ))}
                 </select>
               </label>

               <label className="contents">
                 <span className="sr-only">金額</span>
                 <input
                   type="number"
                   step="0.01"
                   placeholder={`${t.amountPh} (${getFinalCurrency()})`}
                   value={amount}
                   onChange={(e) => setAmount(e.target.value)}
                   className="w-full px-3 h-[52px] bg-black rounded-xl border border-gray-800 focus:border-blue-600 focus:outline-none appearance-none text-[15px] font-medium leading-normal placeholder:text-gray-500"
                 />
               </label>
             </div>

             {/* Date + Note (collapsible advanced) */}
             <details
               open={advancedOpen}
               onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
               className="bg-black rounded-xl border border-gray-800 group overflow-hidden"
             >
               <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer px-3 h-[44px] flex items-center justify-between hover:bg-gray-900/50 transition-colors">
                 <span className="text-sm text-gray-300 truncate flex-1 min-w-0">
                   📅 {date === new Date().toISOString().slice(0,10) ? '今日' : formatDate(date)}
                   {note && <span className="text-gray-500"> · 📝 {note}</span>}
                 </span>
                 <ChevronDown className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform flex-shrink-0 ml-2" aria-hidden="true" />
               </summary>
               <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-3">
                 <label className="contents">
                   <span className="sr-only">日期</span>
                   <input
                     type="date"
                     value={date}
                     onChange={(e) => setDate(e.target.value)}
                     className="w-full px-3 h-[44px] bg-[#1c1c1e] rounded-lg border border-gray-700 focus:border-blue-600 focus:outline-none appearance-none text-[14px] font-medium leading-normal"
                   />
                 </label>
                 <label className="contents">
                   <span className="sr-only">備註</span>
                   <input
                     type="text"
                     placeholder={t.notePh}
                     value={note}
                     onChange={(e) => setNote(e.target.value)}
                     className="w-full px-3 h-[44px] bg-[#1c1c1e] rounded-lg border border-gray-700 focus:border-blue-600 focus:outline-none text-[14px] font-medium leading-normal placeholder:text-gray-500"
                   />
                 </label>
               </div>
             </details>

             {/* Custom Currency Input */}
             {currency === 'OTHER' && (
               <input
                 type="text"
                 placeholder="輸入幣種代碼 (如: SGD, MYR)"
                 aria-label="自訂幣種代碼"
                 value={customCurrency}
                 onChange={(e) => setCustomCurrency(e.target.value.toUpperCase())}
                 className="w-full p-3 bg-black rounded-xl border border-gray-800 text-sm placeholder:text-gray-500"
                 maxLength={5}
               />
             )}

             {/* Exchange Rate + HKD preview (combined compact row) */}
             {((currency !== 'HKD' && currency !== 'OTHER') ||
               (currency === 'OTHER' && customCurrency.trim())) && (
               <div className="bg-black rounded-xl border border-gray-800 p-2 space-y-1">
                 <div className="flex items-center gap-2">
                   <span className="text-[11px] font-mono font-bold text-gray-300 bg-gray-800/80 px-2 py-1 rounded-md whitespace-nowrap">
                     {getFinalCurrency()}→HKD
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
                         [code]: e.target.value,
                       }));
                     }}
                     className="flex-1 min-w-0 px-2 py-1.5 bg-[#1c1c1e] rounded-lg border border-gray-700 text-sm focus:border-blue-600 focus:outline-none"
                     aria-label={`${getFinalCurrency()} 兌 HKD 匯率`}
                   />
                   <button
                     onClick={() => fetchExchangeRate(getFinalCurrency())}
                     disabled={fetchingRate}
                     className="min-w-11 h-9 flex items-center justify-center bg-blue-600/20 text-blue-300 rounded-lg text-xs hover:bg-blue-600/30 transition-colors disabled:opacity-50"
                     aria-label="自動取得匯率"
                     title="自動取得匯率"
                   >
                     {fetchingRate ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                   </button>
                 </div>
                 {amount && calculateHKD() > 0 && (
                   <div className="text-xs text-blue-300 text-right pr-1">
                     ≈ HKD ${calculateHKD().toFixed(2)}
                   </div>
                 )}
               </div>
             )}

             <div className="space-y-3">
                {/* 誰付錢 - Avatar Style */}
                <div className="space-y-2">
                  <span className="text-xs text-gray-500">{t.whoPaid}:</span>
                  <div className="flex flex-wrap gap-3 py-3 px-1">
                    {data.members.map((m, idx) => (
                      <button
                        key={m.id}
                        onClick={() => setPayerId(m.id)}
                        className={`relative w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                          payerId === m.id
                            ? 'border-white scale-110 shadow-lg shadow-blue-500/50'
                            : 'border-gray-700 opacity-60 hover:opacity-100 hover:scale-105'
                        }`}
                        style={{
                          backgroundColor: getAvatarColor(idx),
                        }}
                        aria-label={`付款人 ${m.name}`}
                        aria-pressed={payerId === m.id}
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
                    <span className="text-xs text-gray-500">{t.whoSplit}:</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setParticipantIds(data.members.map(m => m.id))}
                        className="text-xs px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors font-medium"
                      >
                        {t.selectAll}
                      </button>
                      <button
                        onClick={() => setParticipantIds([])}
                        className="text-xs px-3 py-1 bg-gray-700/50 text-gray-400 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                      >
                        {t.deselectAll}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 py-3 px-1">
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
                          className={`relative w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                            isSelected
                              ? 'border-white ring-2 ring-offset-2 ring-offset-black ring-blue-500 scale-110 shadow-lg shadow-blue-500/50'
                              : 'border-gray-700 opacity-60 hover:opacity-100 hover:scale-105'
                          }`}
                          style={{
                            backgroundColor: getAvatarColor(idx),
                          }}
                          aria-label={`分擔者 ${m.name}`}
                          aria-pressed={isSelected}
                          title={m.name}
                        >
                          {getAvatarText(m.name)}
                          {isSelected && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-black flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Split Mode Toggle (segmented control) */}
                {participantIds.length > 0 && (
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-xs text-gray-500 whitespace-nowrap">{t.splitMode}:</span>
                    <div className="flex bg-gray-900 border border-gray-800 rounded-full p-0.5" role="group" aria-label={t.splitMode}>
                      <button
                        onClick={() => {
                          setSplitMode('equal');
                          setCustomSplits({});
                        }}
                        aria-pressed={splitMode === 'equal'}
                        className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all ${
                          splitMode === 'equal'
                            ? 'bg-blue-600 text-white font-bold shadow-sm'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        {t.equalSplit}
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
                        aria-pressed={splitMode === 'custom'}
                        className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all ${
                          splitMode === 'custom'
                            ? 'bg-blue-600 text-white font-bold shadow-sm'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        {t.customSplit}
                      </button>
                    </div>
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
                            aria-label={`${member.name} 嘅分擔金額`}
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
                            已分配: ${splitTotal.toFixed(1)} / ${total.toFixed(1)}
                            {diff > 1 && ` (差額: $${diff.toFixed(1)})`}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
             </div>

             {(() => {
               const missing: string[] = [];
               if (!amount || parseFloat(amount) <= 0) missing.push('金額');
               if (!payerId) missing.push('付款人');
               if (participantIds.length === 0) missing.push('分擔者');
               const finalCur = getFinalCurrency();
               if (finalCur !== 'HKD' && !parseFloat(exchangeRates[finalCur] || '0')) missing.push('匯率');
               return missing.length > 0 ? (
                 <div className="text-xs text-gray-400 text-center">
                   仲未填：<span className="text-yellow-300">{missing.join('、')}</span>
                 </div>
               ) : null;
             })()}

             {editingExpenseId ? (
               <div className="space-y-2">
                 <button
                   onClick={handleUpdateExpense}
                   disabled={submitting}
                   className="w-full py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                 >
                   {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> 更新中...</> : '更新記錄'}
                 </button>
                 <button
                   onClick={handleCancelEdit}
                   disabled={submitting}
                   className="w-full py-3 bg-gray-700 rounded-xl font-bold hover:bg-gray-600 transition-colors disabled:opacity-50"
                 >
                   取消編輯
                 </button>
               </div>
             ) : (
               <button
                 onClick={handleAddExpense}
                 disabled={submitting}
                 className="w-full py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
               >
                 {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> 新增中...</> : t.addRecord}
               </button>
             )}
          </div>

          {/* Balances Section - hide when no expenses */}
          {data.expenses.length > 0 && (
          <div className="bg-[#1c1c1e] rounded-3xl border border-gray-800 overflow-hidden mb-4">
            <button
              onClick={() => setBalancesExpanded(!balancesExpanded)}
              className="w-full p-4 flex justify-between items-center hover:bg-gray-800/50 transition-colors"
            >
              <h3 className="font-bold text-gray-300">{t.balances}</h3>
              <ChevronDown
                className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${balancesExpanded ? 'rotate-180' : ''}`}
              />
            </button>

            {balancesExpanded && (
              <div className="px-4 pb-4 space-y-2">
                {Object.entries(balances).map(([id, bal]) => {
                  const member = data.members.find((m) => m.id === id);
                  if (!member) return null;
                  const memberIdx = data.members.findIndex(m => m.id === id);

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

                  const maxAmount = Math.max(totalPaid, totalConsumed, 1);

                  return (
                    <div key={id} className="bg-black p-3 rounded-xl">
                      <div className="flex items-center gap-3 mb-2">
                        {/* Avatar */}
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: getAvatarColor(memberIdx) }}
                        >
                          {getAvatarText(member.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <span className="font-medium truncate">{member.name}</span>
                            <span className={`text-sm font-bold ${bal > 0 ? "text-green-400" : bal < 0 ? "text-red-400" : "text-gray-500"}`}>
                              {bal > 0 ? `+$${bal.toFixed(1)}` : bal < 0 ? `-$${Math.abs(bal).toFixed(1)}` : "$0"}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Visual bars */}
                      <div className="space-y-1 pl-12">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 w-6">{t.totalAdvanced?.slice(0,1) || '墊'}</span>
                          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500/60 rounded-full transition-all duration-500" style={{ width: `${(totalPaid / maxAmount) * 100}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-500 w-12 text-right">${totalPaid.toFixed(1)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 w-6">{t.totalSpent?.slice(0,1) || '花'}</span>
                          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500/60 rounded-full transition-all duration-500" style={{ width: `${(totalConsumed / maxAmount) * 100}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-500 w-12 text-right">${totalConsumed.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {/* Settlement Plan Section - hide when no expenses */}
          {data.expenses.length > 0 && (
          <div className="bg-[#1c1c1e] rounded-3xl border border-gray-800 overflow-hidden mb-4">
            <button
              onClick={() => setSettlementsExpanded(!settlementsExpanded)}
              className="w-full p-4 flex justify-between items-center hover:bg-gray-800/50 transition-colors"
            >
              <h3 className="font-bold text-gray-300">{t.settlements}</h3>
              <ChevronDown
                className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${settlementsExpanded ? 'rotate-180' : ''}`}
              />
            </button>

            {settlementsExpanded && (
              <div className="px-4 pb-4">
                {settlements.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="text-3xl mb-2">🎉</div>
                    <div className="text-gray-400 text-sm">{t.emptySettlements}</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {settlements.map((s, idx) => {
                      const fromMember = data.members.find(m => m.name === s.from);
                      const toMember = data.members.find(m => m.name === s.to);
                      const fromIdx = fromMember ? data.members.indexOf(fromMember) : 0;
                      const toIdx = toMember ? data.members.indexOf(toMember) : 0;
                      const settlementKey = `${s.from}→${s.to}@${s.amount.toFixed(1)}`;
                      const isPaid = paidSettlements.has(settlementKey);
                      const togglePaid = () => {
                        setPaidSettlements(prev => {
                          const next = new Set(prev);
                          if (next.has(settlementKey)) next.delete(settlementKey);
                          else next.add(settlementKey);
                          if (typeof window !== 'undefined') {
                            try {
                              localStorage.setItem(
                                `tripUtility_paidSettlements_${data.code}`,
                                JSON.stringify(Array.from(next))
                              );
                            } catch {
                              // ignore (private mode / quota)
                            }
                          }
                          return next;
                        });
                      };
                      return (
                      <div
                        key={idx}
                        className={`bg-black p-3 rounded-xl space-y-2 transition-opacity ${isPaid ? 'opacity-50' : ''}`}
                        aria-label={`${s.from} 還 $${s.amount.toFixed(1)} 俾 ${s.to}${isPaid ? '（已付清）' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ring-2 ring-red-500/40"
                            style={{ backgroundColor: getAvatarColor(fromIdx) }}
                          >
                            {getAvatarText(s.from)}
                          </div>
                          <span className={`text-sm font-medium text-red-300 truncate flex-1 min-w-0 ${isPaid ? 'line-through' : ''}`}>{s.from}</span>
                          <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0" aria-hidden="true" />
                          <span className={`text-sm font-medium text-green-300 truncate flex-1 min-w-0 text-right ${isPaid ? 'line-through' : ''}`}>{s.to}</span>
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ring-2 ring-green-500/40"
                            style={{ backgroundColor: getAvatarColor(toIdx) }}
                          >
                            {getAvatarText(s.to)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className={`flex-1 text-center text-base font-bold tracking-tight ${isPaid ? 'text-gray-500 line-through' : 'text-yellow-300'}`}>
                            HKD ${s.amount.toFixed(1)}
                          </div>
                          <button
                            onClick={togglePaid}
                            aria-pressed={isPaid}
                            className={`min-w-11 h-9 px-3 inline-flex items-center justify-center gap-1 rounded-full text-xs font-medium transition-colors ${
                              isPaid
                                ? 'bg-green-500/20 text-green-300'
                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            <Check className={`w-3.5 h-3.5 ${isPaid ? '' : 'opacity-40'}`} />
                            {isPaid ? '已付清' : '標記'}
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {/* Records List - Grouped by Date */}
          <div className="bg-[#1c1c1e] rounded-3xl border border-gray-800 overflow-hidden mb-4">
            <button
              onClick={() => setRecordsExpanded(!recordsExpanded)}
              className="w-full p-4 flex justify-between items-center hover:bg-gray-800/50 transition-colors"
            >
              <h3 className="font-bold text-gray-300">{t.recordList}</h3>
              <ChevronDown
                className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${recordsExpanded ? 'rotate-180' : ''}`}
              />
            </button>

            {recordsExpanded && (
              <div className="px-4 pb-4">
                {/* Active category filter indicator */}
                {categoryFilter && (() => {
                  const cat = CATEGORIES.find(c => c.id === categoryFilter);
                  return cat ? (
                    <div className="mb-3 inline-flex items-center gap-2 bg-white/10 rounded-full pl-3 pr-1 py-1 text-xs">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat.id] }} />
                      <span>只睇「{cat.icon} {cat.label}」</span>
                      <button
                        onClick={() => setCategoryFilter(null)}
                        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
                        aria-label="清除類別篩選"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null;
                })()}
                {expensesByDate.length === 0 && (
                  <div className="text-center py-10">
                    <div className="text-5xl mb-3">📭</div>
                    <div className="text-gray-400 mb-1">{categoryFilter ? t.emptyFiltered : t.emptyRecords}</div>
                    <div className="text-xs text-gray-500">{categoryFilter ? t.emptyFilteredHint : t.emptyRecordsHint}</div>
                  </div>
                )}

                {/* Date Cards */}
                <div className="space-y-3">
                  {expensesByDate.map((dateGroup) => {
                    const isExpanded = expandedDates.includes(dateGroup.date);

                    // Toggle handler for this specific date - Multi-expand mode
                    const handleToggle = () => {
                      setExpandedDates(prev =>
                        prev.includes(dateGroup.date)
                          ? prev.filter(d => d !== dateGroup.date)  // Remove if already expanded
                          : [...prev, dateGroup.date]               // Add if not expanded
                      );
                    };

                  return (
                    <div key={dateGroup.date} className="border border-gray-800 rounded-2xl overflow-hidden">
                      {/* Date Header Card */}
                      <button
                        type="button"
                        onClick={handleToggle}
                        className="w-full p-4 bg-black hover:bg-gray-900/80 transition-colors flex justify-between items-center"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center text-blue-300">
                            <Calendar className="w-5 h-5" aria-hidden="true" />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-white">{formatDate(dateGroup.date)}</div>
                            <div className="mt-0.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-800 text-[10px] text-gray-300 font-medium">
                                {dateGroup.expenses.length} {t.recordsSuffix}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <div>
                            <div className="font-bold text-white text-sm">
                              <span className="text-gray-500 text-[10px] font-normal mr-1">HKD</span>
                              ${dateGroup.total.toFixed(1)}
                            </div>
                          </div>
                          <ChevronDown
                            className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          />
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
                              <div key={e.id} className="flex items-stretch bg-[#1c1c1e] rounded-xl border border-gray-800 overflow-hidden">
                                {/* Category color indicator */}
                                <div className="w-1 flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[e.category || 'other'] || '#6b7280' }} />
                                <div className="flex justify-between items-center flex-1 p-3 min-w-0">
                                <div className="flex-1 min-w-0 pr-3">
                                  <div className="font-bold text-sm">
                                    {CATEGORIES.find(c => c.id === e.category)?.icon || "📝"} {(() => { const v = t[e.category as keyof typeof t]; return typeof v === 'string' ? v : e.title; })()}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {data.members.find(m => m.id === e.payerId)?.name} {t.paidSuffix} • {beneficiariesText}
                                    {e.originalCurrency && e.originalCurrency !== 'HKD' && e.originalAmount && (
                                      <span className="ml-1 text-gray-400">({t.origPrefix} {e.originalCurrency} {e.originalAmount.toFixed(0)})</span>
                                    )}
                                  </div>
                                  {e.note && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      <span className="opacity-70">📝</span> {e.note}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right flex items-center gap-0.5 flex-shrink-0">
                                  <div className="font-bold text-sm mr-1">${e.amountHKD.toFixed(1)}</div>
                                  <button
                                    onClick={() => handleEdit(e)}
                                    className="min-w-11 min-h-11 flex items-center justify-center text-lg hover:bg-blue-500/20 rounded-lg transition-colors"
                                    aria-label="編輯記錄"
                                    title="編輯"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleDelete(e.id)}
                                    className="min-w-11 min-h-11 flex items-center justify-center hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                                    aria-label="刪除記錄"
                                    title="刪除"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
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
            )}
          </div>

          {/* Footer Branding */}
          <div className="mt-6 mb-4 text-center">
            <a
              href="https://www.instagram.com/midlife_ai_hk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <span>Made by</span>
              <span className="font-medium">@midlife_ai_hk</span>
            </a>
          </div>
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<TripLoader />}>
      <ExpensesPageContent />
    </Suspense>
  );
}
