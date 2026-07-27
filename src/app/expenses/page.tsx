"use client";

import { Suspense, useEffect, useMemo, useState, useRef, useOptimistic, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createTrip, getTripByCode, addExpense, deleteExpense, updateExpense, renameTrip } from "./actions";
import { toast, Toaster } from 'sonner';
import { Star, FileSpreadsheet, Share2, FolderPlus, RotateCw, ChevronDown, Check, Copy, Loader2 } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { enUS, zhTW } from 'date-fns/locale';
import { logger } from '@/lib/logger';
import { applyExpenseOptimistic, type TripData, type ExpenseItem } from "./types";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  CURRENCIES,
  getAvatarColor,
  TOAST_STYLE,
  TOAST_DURATION,
  getAvatarText,
} from "./constants";
import { buildTripShareData, copyTextToClipboard } from "./shareUtils";
import { TripLoader } from "./components/TripLoader";
import { CreateTripScreen } from "./components/CreateTripScreen";
import { BalancesSection } from "./components/BalancesSection";
import { SettlementSection } from "./components/SettlementSection";
import { RecordsList } from "./components/RecordsList";
import { TotalCard } from "./components/TotalCard";
import { ConfirmModal } from "./components/ConfirmModal";
import { FavoritesModal } from "./components/FavoritesModal";

function ExpensesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const { language, setLanguage, t } = useTranslation();

  // State
  const [data, setData] = useState<TripData | null>(null);
  // Optimistic 層：渲染由 optimisticExpenses 出發，即時反映新增/改/刪
  const [, startTransition] = useTransition();
  const [optimisticExpenses, applyOptimistic] = useOptimistic(
    data?.expenses ?? [],
    applyExpenseOptimistic,
  );
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
  const [retryingCode, setRetryingCode] = useState(false);
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
    if (typeof window === "undefined") return;
    const shareData = buildTripShareData(data?.name, window.location.href);

    // Try Web Share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        showToast("已分享");
        return;
      } catch (err) {
        // 用戶取消分享 -> 靜默處理，唔使 fallback 都唔使提示
        if ((err as Error)?.name === 'AbortError') return;
        // 其他分享失敗（例如權限被拒）-> 跌落去用複製連結 fallback
      }
    }

    // Fallback to clipboard (永遠唔會 throw / unhandled rejection)
    const copied = await copyTextToClipboard(shareData.url);
    if (copied) {
      showToast("連結已複製，貼俾同行朋友啦");
    } else {
      showToast("複製失敗，請手動複製網址", "error");
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
          // 記住呢個旅程，俾首頁 `/` 下次直接 resume
          // （修正：之前 BottomNav 係死碼，冇人寫呢個 cookie，所以 resume 從來唔 work）
          document.cookie = `last_trip_code=${res.code}; path=/; max-age=2592000; samesite=lax`;
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
        if (!cancelled) {
          setLoading(false);
          // 修正：建立旅程成功後 handleCreateTrip 冇 reset submitting，
          // 會令新增掣卡住「新增中…」直到 safety timer。載入旅程時一定唔係 submit 中，安全 reset。
          setSubmitting(false);
        }
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
          logger.error('Failed to parse exchange rates:', e);
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
    // 刻意只依賴 code + name（rename 時先 re-sync），唔依賴成個 data 物件，
    // 以免每次支出變動都重新寫入 recent trips
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      logger.error("Reload failed", error);
    }
  };

  // 多人即時更新（infra-free）：當 tab 重新可見時靜默 refetch，
  // 令同一旅程嘅其他人加咗支出後，切返個 app 就見到最新數（毋須 websocket）。
  useEffect(() => {
    if (!code) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") reloadTrip();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
    // reloadTrip 由 code 決定；只需喺 code 變化時重新訂閱
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

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

    setSubmitting(true);
    setLoading(true);
    const safetyTimer = setTimeout(() => {
      logger.warn("[createTrip] safety timeout fired (30s) — unlocking button");
      setSubmitting(false);
      setLoading(false);
      showToast("提交逾時，請檢查網絡", "error");
    }, 30000);

    try {
      const res = await createTrip(trimmedName, members);
      clearTimeout(safetyTimer);
      // 成功後直接跳轉，不需要存 localStorage，因為跳轉後的 URL 包含 code，會觸發上面的 useEffect
      router.replace(`/expenses?code=${res.code}`);
    } catch (e) {
      clearTimeout(safetyTimer);
      logger.error("[createTrip] failed:", e);
      const msg = e instanceof Error ? e.message : "建立失敗，請檢查網絡";
      showToast(msg, "error");
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

    // Optimistic 暫存記錄：用表單現有值組成顯示用 shape（唔做新嘅金額運算）
    const payerName = data.members.find((m) => m.id === payerId)?.name ?? "";
    const optimisticParticipants =
      splitMode === 'custom'
        ? participantIds.map((id) => ({ id, customAmount: parseFloat(customSplits[id]) }))
        : participantIds;
    const tempExpense: ExpenseItem = {
      id: `temp-${Date.now()}`,
      title: CATEGORIES.find((c) => c.id === category)?.label ?? "其他",
      category,
      note: note || null,
      date,
      payerId,
      payerName,
      amountHKD,
      participants: optimisticParticipants,
      originalCurrency: finalCurrency,
      originalAmount: amountValue,
    };

    startTransition(async () => {
      applyOptimistic({ type: 'add', expense: tempExpense }); // 即時顯示
      setSubmitting(true);
      try {
        await addExpense({
          code: data.code,
          title: tempExpense.title,
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
        setExpandedDates((prev) => (prev.includes(date) ? prev : [...prev, date]));

        setAmount("");
        setNote("");
        setCurrency('HKD'); // Reset to HKD
        setCustomCurrency(''); // Clear custom currency
        setSplitMode('equal'); // Reset split mode
        setCustomSplits({}); // Clear custom splits
        // 重新全選所有參與者
        setParticipantIds(data.members.map((m) => m.id));
        await reloadTrip(); // server 真值回來，optimistic 自動退場
        showToast("已新增");
      } catch (e) {
        logger.error("[addExpense] failed:", e);
        const msg = e instanceof Error ? e.message : "新增失敗";
        showToast(msg, "error");
      } finally {
        setSubmitting(false);
      }
    });
  };

  // 5. 刪除支出 (Delete Expense) - Fix #9: Use custom modal
  const handleDelete = (expenseId: string) => {
    if (!data) return;
    setConfirmModal({
      message: "確定刪除此記錄？",
      onConfirm: () => {
        startTransition(async () => {
          applyOptimistic({ type: 'delete', id: expenseId }); // 即時移除
          try {
            await deleteExpense(data.code, expenseId);
            await reloadTrip();
            showToast("已刪除");
          } catch (e) {
            logger.error("[deleteExpense] failed:", e);
            const msg = e instanceof Error ? e.message : "刪除失敗";
            showToast(msg, "error");
          }
        });
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

    // Optimistic 更新記錄：用表單現有值組成顯示用 shape（唔做新嘅金額運算）
    const payerName = data.members.find((m) => m.id === payerId)?.name ?? "";
    const optimisticParticipants =
      splitMode === 'custom'
        ? participantIds.map((id) => ({ id, customAmount: parseFloat(customSplits[id]) }))
        : participantIds;
    const updatedExpense: ExpenseItem = {
      id: editingExpenseId,
      title: CATEGORIES.find((c) => c.id === category)?.label ?? "其他",
      category,
      note: note || null,
      date,
      payerId,
      payerName,
      amountHKD,
      participants: optimisticParticipants,
      originalCurrency: finalCurrency,
      originalAmount: amountValue,
    };

    startTransition(async () => {
      applyOptimistic({ type: 'update', expense: updatedExpense }); // 即時反映
      setSubmitting(true);
      try {
        await updateExpense({
          code: data.code,
          expenseId: editingExpenseId,
          title: updatedExpense.title,
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
        await reloadTrip(); // server 真值回來，optimistic 自動退場
        showToast("已更新記錄");
      } catch (e) {
        logger.error("[updateExpense] failed:", e);
        const msg = e instanceof Error ? e.message : "更新失敗";
        showToast(msg, "error");
      } finally {
        setSubmitting(false);
      }
    });
  };

  // 10. 匯出 Excel (Export Excel with 3 Sheets)
  const handleExportExcel = async () => {
    if (!data || optimisticExpenses.length === 0) {
      showToast("沒有記錄可匯出", "error");
      return;
    }

    try {
      // 只喺需要時先載入 exceljs，避免谷大首屏 bundle
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();

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

      const transactionRows = optimisticExpenses.map(e => {
        const row: (string | number)[] = [
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

      const ws1 = wb.addWorksheet('交易紀錄');
      ws1.addRow(transactionHeaders);
      transactionRows.forEach((r) => ws1.addRow(r));

      // Sheet 2: 結餘狀況 (Balances)
      const balanceHeaders = ['姓名', '代墊金額 (Paid)', '消費金額 (Share)', '淨結餘 (Balance)'];
      const balanceRows = data.members.map(member => {
        // Calculate total paid
        const totalPaid = optimisticExpenses
          .filter(e => e.payerId === member.id)
          .reduce((sum, e) => sum + e.amountHKD, 0);

        // Calculate total share
        const totalShare = optimisticExpenses
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

      const ws2 = wb.addWorksheet('結餘狀況');
      ws2.addRow(balanceHeaders);
      balanceRows.forEach((r) => ws2.addRow(r));

      // Sheet 3: 建議還款 (Repayments)
      const repaymentHeaders = ['付款人 (From)', '收款人 (To)', '金額 (HKD)'];
      const repaymentRows = settlements.map(s => [s.from, s.to, s.amount]);

      const ws3 = wb.addWorksheet('建議還款');
      ws3.addRow(repaymentHeaders);
      repaymentRows.forEach((r) => ws3.addRow(r));

      // Generate filename with timestamp (sanitize trip name for filesystem)
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const safeName = (data.name || 'Trip').replace(/[\\/:*?"<>|]/g, '_');
      const filename = `${safeName}_Report_${timestamp}.xlsx`;

      // Write workbook to buffer and trigger download
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      showToast("已匯出 Excel · 請睇下載資料夾", "success");
    } catch (error) {
      logger.error('Export error:', error);
      showToast("匯出失敗", "error");
    }
  };

  // 計算結餘 (Balances)
  const balances = useMemo(() => {
    if (!data) return {};
    const bal: Record<string, number> = {};
    data.members.forEach((m) => (bal[m.id] = 0));

    optimisticExpenses.forEach((e) => {
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
  }, [data, optimisticExpenses]);

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
    const transactions: Array<{ from: string; to: string; fromId: string; toId: string; amount: number }> = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const payment = Math.min(debtor.amount, creditor.amount);

      transactions.push({
        from: debtor.name,
        to: creditor.name,
        fromId: debtor.id,
        toId: creditor.id,
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
      ? optimisticExpenses.filter(e => e.category === categoryFilter)
      : optimisticExpenses;

    // Group expenses by date
    const groups = filtered.reduce((acc, expense) => {
      const date = expense.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(expense);
      return acc;
    }, {} as Record<string, typeof optimisticExpenses>);

    // Convert to array and sort by date (newest first)
    const sortedGroups = Object.entries(groups)
      .map(([date, expenses]) => ({
        date,
        expenses,
        total: expenses.reduce((sum, e) => sum + e.amountHKD, 0),
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return sortedGroups;
  }, [data, optimisticExpenses, categoryFilter]);

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

  // 情況 B 用：有 code 但搵唔到旅程時「重試」，用返 reloadTrip 靜默 refetch，唔使成頁 reload
  const handleRetryCode = async () => {
    if (retryingCode) return;
    setRetryingCode(true);
    try {
      await reloadTrip();
    } finally {
      setRetryingCode(false);
    }
  };

  // --- 畫面渲染邏輯 ---

  // 情況 A: 正在跟 Server 拿資料
  if (loading) {
    return <TripLoader />;
  }

  // 情況 B: 有 code 但找不到資料 -> 顯示錯誤
  if (code && !data) {
    return (
      <div className="min-h-[100dvh] bg-black text-white flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mb-4 flex justify-center">
            <RotateCw className="w-12 h-12 text-blue-500" />
          </div>
          <h1 className="text-lg font-semibold mb-2">暫時開唔到呢個旅程</h1>
          <p className="text-sm text-gray-400 mb-4">
            可能係連結有誤，或者網絡暫時有問題。重試唔會刪除任何資料。
          </p>
          <div className="text-sm text-gray-500 mb-6">旅程碼：{code}</div>
          <button
            onClick={handleRetryCode}
            disabled={retryingCode}
            className="min-h-[44px] w-full px-8 py-3 bg-blue-600 rounded-xl hover:bg-blue-500 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black flex items-center justify-center gap-2"
          >
            {retryingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            再試一次
          </button>
          <button
            onClick={() => router.push('/expenses')}
            className="mt-4 min-h-[44px] w-full px-8 py-3 border border-gray-600 text-gray-400 rounded-xl hover:bg-gray-800 hover:scale-105 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            輸入另一個旅程碼
          </button>
        </div>
      </div>
    );
  }

  // 情況 C: 沒有 code -> 顯示「建立新旅程」
  if (!code) {
    return (
      <CreateTripScreen
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        onJoin={handleJoinTrip}
        recentTrips={recentTrips}
        setRecentTrips={setRecentTrips}
        onOpenTrip={(c) => router.push(`/expenses?code=${c}`)}
        tripName={tripName}
        setTripName={setTripName}
        memberNames={memberNames}
        setMemberNames={setMemberNames}
        onCreate={handleCreateTrip}
        submitting={submitting}
      />
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
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal(null)}
        />
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
            {/* Trip code chip with inline copy */}
            <div className="inline-flex items-center gap-1 bg-gray-900/60 border border-gray-800 rounded-full pl-3 pr-1 py-1">
              <span className="font-mono text-xs tracking-widest text-gray-300">{data.code}</span>
              <button
                onClick={async () => {
                  const copied = await copyTextToClipboard(data.code);
                  if (copied) {
                    setCodeCopied(true);
                    showToast("旅程碼已複製");
                    setTimeout(() => setCodeCopied(false), 1500);
                  } else {
                    showToast("複製失敗，請手動 select", "error");
                  }
                }}
                className={`ml-1 min-w-11 min-h-11 flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  codeCopied
                    ? 'text-green-400 bg-green-500/15'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                aria-label="複製旅程碼"
                title="複製旅程碼"
              >
                {codeCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            {/* 分享權限提示：講清楚有連結嘅人都入到嚟 */}
            <p className="mt-1.5 text-[11px] text-gray-500">
              🔓 有呢個連結嘅人，都可以睇同編輯呢個旅程
            </p>
          </div>

          {/* Favorites Modal */}
          {showFavoritesModal && (
            <FavoritesModal onClose={() => setShowFavoritesModal(false)} />
          )}

          {/* Total Card - Premium Gradient */}
          <TotalCard
            expenses={optimisticExpenses}
            members={data.members}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
          />

          {/* Action Buttons Row - Share is the primary action, rest live in a 更多 overflow menu */}
          <div className="flex items-stretch gap-2 mb-6">
            <button
              onClick={handleShareLink}
              className="flex-grow min-h-11 h-11 flex items-center justify-center gap-2 bg-blue-600 rounded-xl text-white font-bold hover:bg-blue-500 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              aria-label="分享旅程連結，任何人有連結都可以睇同編輯"
            >
              <Share2 className="w-[18px] h-[18px]" />
              分享旅程
            </button>
            <details className="relative">
              <summary
                className="list-none [&::-webkit-details-marker]:hidden cursor-pointer min-w-11 min-h-11 h-11 px-4 flex items-center justify-center gap-1 bg-gray-800/80 rounded-xl text-gray-300 hover:bg-gray-700 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="更多操作"
              >
                更多
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-gray-800 bg-[#1c1c1e] shadow-lg overflow-hidden">
                <button
                  onClick={(e) => {
                    handleExportExcel();
                    e.currentTarget.closest('details')?.removeAttribute('open');
                  }}
                  className="w-full min-h-11 h-11 px-4 flex items-center gap-3 text-sm text-gray-200 hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
                >
                  <FileSpreadsheet className="w-[18px] h-[18px]" />
                  匯出 Excel
                </button>
                <button
                  onClick={(e) => {
                    setShowFavoritesModal(true);
                    e.currentTarget.closest('details')?.removeAttribute('open');
                  }}
                  className="w-full min-h-11 h-11 px-4 flex items-center gap-3 text-sm text-gray-200 hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
                >
                  <Star className="w-[18px] h-[18px]" />
                  收藏 App
                </button>
                <button
                  onClick={(e) => {
                    router.push('/expenses');
                    e.currentTarget.closest('details')?.removeAttribute('open');
                  }}
                  className="w-full min-h-11 h-11 px-4 flex items-center gap-3 text-sm text-gray-200 hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
                >
                  <FolderPlus className="w-[18px] h-[18px]" />
                  新旅程
                </button>
              </div>
            </details>
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
          {optimisticExpenses.length > 0 && (
            <BalancesSection
              expenses={optimisticExpenses}
              members={data.members}
              balances={balances}
              expanded={balancesExpanded}
              onToggle={() => setBalancesExpanded(!balancesExpanded)}
            />
          )}

          {/* Settlement Plan Section - hide when no expenses */}
          {optimisticExpenses.length > 0 && (
            <SettlementSection
              settlements={settlements}
              members={data.members}
              tripCode={data.code}
              paidSettlements={paidSettlements}
              setPaidSettlements={setPaidSettlements}
              expanded={settlementsExpanded}
              onToggle={() => setSettlementsExpanded(!settlementsExpanded)}
            />
          )}

          {/* Records List - Grouped by Date */}
          <RecordsList
            dateGroups={expensesByDate}
            members={data.members}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            expandedDates={expandedDates}
            setExpandedDates={setExpandedDates}
            onEdit={handleEdit}
            onDelete={handleDelete}
            formatDate={formatDate}
            expanded={recordsExpanded}
            onToggle={() => setRecordsExpanded(!recordsExpanded)}
          />

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
