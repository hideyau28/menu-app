"use client";

import { Suspense, useEffect, useMemo, useState, useRef, useOptimistic, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createTrip, getTripByCode, addExpense, deleteExpense, updateExpense, renameTrip } from "./actions";
import { toast, Toaster } from 'sonner';
import { Star, FileSpreadsheet, Share2, FolderPlus, RotateCw, ChevronDown, Check, Copy, Loader2, Pencil, ArrowRight } from 'lucide-react';
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
import { NeonRouteRibbon } from "./components/NeonRouteRibbon";
import { ConfirmModal } from "./components/ConfirmModal";
import { FavoritesModal } from "./components/FavoritesModal";
import { TripCreatedScreen } from "./components/TripCreatedScreen";

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
  // 啱啱建立完旅程 -> 先顯示 TripCreatedScreen，逼旅程碼離開部機先入記帳頁
  const [justCreated, setJustCreated] = useState(false);

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

  // Auto-open the split adjustment disclosure + flash form ring when entering edit mode
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
      // router.replace 係同一條 route，唔會 unmount，所以呢個 flag 過得到跳轉
      setJustCreated(true);
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

  // 情況 C2: 啱啱建立完 -> 先叫人記低旅程碼，之後先入記帳頁
  if (justCreated && data) {
    return (
      <TripCreatedScreen
        tripName={data.name}
        code={data.code}
        memberCount={data.members.length}
        onShare={handleShareLink}
        onCopyCode={async () => {
          const copied = await copyTextToClipboard(data.code);
          if (copied) {
            showToast("旅程碼已複製");
          } else {
            showToast("複製失敗，請手動抄低", "error");
          }
        }}
        onEnter={() => setJustCreated(false)}
      />
    );
  }

  // 情況 D: 有 code 且有 data -> 顯示主畫面 (Dashboard)
  if (!data) {
    // 理論上不會到達這裡，但為了 TypeScript 類型安全
    return null;
  }

  /*
    DIRECTION CONTRACT — Afterhours Ledger (Composition C, approved)
    THESIS: Every shared expense is a station on one living night route; refuse the
      generic black/gray/blue card dashboard.
    OWN-WORLD: Night asphalt field, cyan live route, magenta settlement branch, amber
      attention signal, destination-board type, ticket-cut operation deck.
    STORY: See the trip and travelers, record the next expense in seconds, then follow
      the route to who pays whom.
    FIRST VIEWPORT: Oversized trip title/route code + live traveler count, horizontal member
      route ribbon, then a dominant ticket-style Quick Add with CTA visible at 390x844.
    FORM: semantic HTML/CSS/SVG — never the generated comp as a raster UI.
  */

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div
      className="min-h-[101vh] bg-night-asphalt p-4 pt-6 pb-40 text-cloud-white lg:pt-12"
      style={{
        backgroundImage:
          'radial-gradient(60rem 60rem at 0% 0%, rgba(94,235,255,0.06), transparent 60%), radial-gradient(52rem 52rem at 100% 100%, rgba(255,61,154,0.05), transparent 60%)',
        backgroundAttachment: 'fixed',
      }}
    >
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
      <div className="mx-auto max-w-md lg:max-w-5xl lg:grid lg:grid-cols-[1fr_420px] lg:items-start lg:gap-x-6">
          {/* Header — destination board */}
          <div className="mb-3 lg:col-start-1 lg:row-start-1 lg:mb-5">
            {/* Top strip: 產品/航線識別 + 改名 + 語言切換 */}
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-mist-blue">
                {language === 'zh' ? '旅程記帳 · 夜行航線' : 'TRIP LEDGER · NIGHT ROUTE'}
              </span>
              <div className="flex flex-shrink-0 items-center gap-2">
                {!nameEditing && (
                  <button
                    onClick={() => { setNameDraft(data.name); setNameEditing(true); }}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 text-mist-blue transition-colors hover:border-route-cyan/60 hover:text-cloud-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route-cyan"
                    aria-label={language === 'zh' ? '改旅程名稱' : 'Rename trip'}
                    title={language === 'zh' ? '改旅程名稱' : 'Rename trip'}
                  >
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
                <button
                  onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
                  className="min-h-11 min-w-11 rounded-full border border-white/15 px-3 py-1 text-xs font-bold text-mist-blue transition-colors hover:border-route-cyan/60 hover:text-cloud-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route-cyan"
                  aria-label={language === 'zh' ? '切換到英文' : '切換到中文'}
                >
                  {language === 'zh' ? 'EN' : '中'}
                </button>
              </div>
            </div>

            {/* 目的地大字：旅程名（可即場改名） */}
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
                className="w-full min-w-0 border-b-2 border-route-cyan/60 bg-transparent px-0 py-0 text-4xl font-extrabold tracking-tight text-cloud-white focus:border-route-cyan focus:outline-none sm:text-5xl"
                aria-label="編輯旅程名稱"
              />
            ) : (
              <h1
                className="cursor-text break-words text-4xl font-extrabold leading-[1.05] tracking-tight text-cloud-white transition-colors hover:text-route-cyan sm:text-5xl"
                title={`${data.name} · 㩒一下改名`}
                onClick={() => { setNameDraft(data.name); setNameEditing(true); }}
              >
                {data.name}
              </h1>
            )}

            {/* 航線識別碼 + compact 總支出 */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-midnight-platform pl-3 pr-1 py-1">
                <span className="font-mono text-xs tracking-[0.2em] text-route-cyan">{data.code}</span>
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
                  className={`ml-1 flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route-cyan ${
                    codeCopied
                      ? 'bg-route-cyan/15 text-route-cyan'
                      : 'text-mist-blue hover:bg-white/5 hover:text-cloud-white'
                  }`}
                  aria-label="複製旅程碼"
                  title="複製旅程碼"
                >
                  {codeCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="text-right">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-route-cyan">Live Route</div>
                <div className="text-xs font-medium text-mist-blue">
                  {language === 'zh' ? `${data.members.length} 位同行` : `${data.members.length} travelers`}
                </div>
              </div>
            </div>

            {/* 分享權限提示：講清楚有連結嘅人都入到嚟 */}
            <p className="mt-2 text-xs text-mist-blue">
              🔓 有呢個連結嘅人，都可以睇同編輯呢個旅程
            </p>
          </div>

          {/* 霓虹航線帶：真實成員 = 命名站點，亮起現時付款人，尾接 magenta 結算分支 */}
          <div className="lg:col-start-1 lg:row-start-2">
            <NeonRouteRibbon
              members={data.members}
              activeId={payerId}
              routeLabel={language === 'zh' ? '同行航線' : 'TRAVEL ROUTE'}
              branchLabel={language === 'zh' ? '結算' : 'Settle'}
            />
          </div>

          {/* Favorites Modal */}
          {showFavoritesModal && (
            <FavoritesModal onClose={() => setShowFavoritesModal(false)} />
          )}
          {/* 右欄：Quick Add 車票／月台捕捉台（桌面 sticky） */}
          <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-4">
          {/* Add Expense Form — ticket-cut transit deck */}
          <div ref={formRef} className={`relative mb-8 space-y-3 overflow-hidden rounded-tl-[28px] rounded-br-[28px] rounded-tr-lg rounded-bl-lg border p-4 transition-all duration-500 lg:space-y-4 lg:p-5 ${
            editingExpenseId
              ? `border-signal-amber/50 bg-midnight-platform ${editFlash ? 'ring-4 ring-signal-amber/60' : 'ring-1 ring-signal-amber/30'}`
              : 'border-white/10 bg-midnight-platform'
          }`}>
             {/* 車票頂部訊號燈條：cyan 主航線／編輯時 amber 注意 */}
             <div aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] ${editingExpenseId ? 'bg-signal-amber' : 'bg-gradient-to-r from-route-cyan via-route-cyan/50 to-transparent'}`} />
             {/* #3: Edit mode banner */}
             {editingExpenseId && (
               <div className="-mt-1 flex items-center justify-between rounded-lg bg-signal-amber/15 px-3 py-2 text-xs font-bold text-signal-amber">
                 <span>✏️ 編輯模式</span>
                 <button onClick={handleCancelEdit} className="text-mist-blue hover:text-cloud-white">✕ 取消</button>
               </div>
             )}
             {/* Quick Add heading — 月台資訊 */}
             <div className="flex items-end justify-between gap-2">
               <div className="space-y-0.5">
                 <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-route-cyan">Quick Add · 下一站</div>
                 <h2 className="text-lg font-bold text-cloud-white">快速記一筆</h2>
               </div>
               <p className="pb-0.5 text-right text-xs text-mist-blue">
                 {date === todayISO ? '今日' : formatDate(date)} · {splitMode === 'equal' ? (participantIds.length === data.members.length ? '全員平均分' : `${participantIds.length} 人平均分`) : '自訂分帳'}
               </p>
             </div>
             {/* 類別 = 路線站點（橫向排列，可捲動；44px targets） */}
             <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {CATEGORIES.map((c) => {
                  const color = CATEGORY_COLORS[c.id] || '#6b7280';
                  const isSelected = category === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setCategory(c.id)}
                      aria-pressed={isSelected}
                      className={`group relative flex min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-1.5 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-night-asphalt motion-reduce:transition-none motion-reduce:active:scale-100 lg:min-h-[56px] lg:py-2 ${
                        isSelected
                          ? 'border-route-cyan bg-route-cyan/10 shadow-[0_0_12px_rgba(94,235,255,0.25)]'
                          : 'border-white/10 bg-elevated-ink/60 hover:border-white/25'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: color, boxShadow: isSelected ? `0 0 6px ${color}` : undefined }}
                      />
                      <span className="text-lg leading-none">{c.icon}</span>
                      <span className={`px-0.5 text-center text-[11px] leading-tight ${isSelected ? 'font-bold text-cloud-white' : 'text-mist-blue'}`}>
                        {(() => { const v = t[c.id as keyof typeof t]; return typeof v === 'string' ? v : c.label; })()}
                      </span>
                    </button>
                  );
                })}
             </div>

             {/* 車票穿孔分隔線：站點資訊 ↕ 金額月台 */}
             <div aria-hidden="true" className="ticket-perf mx-1 my-1" />

             {/* Currency + Amount (金額月台 — 主要資料) */}
             <div className="grid grid-cols-[1fr_1.4fr] gap-3">
               <label className="flex flex-col gap-1">
                 <span className="text-xs font-medium text-mist-blue">{t.currency}</span>
                 <select
                   value={currency}
                   onChange={(e) => {
                     const newCurrency = e.target.value;
                     setCurrency(newCurrency);
                     if (newCurrency === 'OTHER') {
                       setCustomCurrency('');
                     }
                   }}
                   className="h-[52px] w-full appearance-none rounded-xl border border-white/10 bg-elevated-ink px-3 text-center text-[15px] font-medium leading-normal text-cloud-white placeholder:text-mist-blue focus:border-route-cyan focus:outline-none focus-visible:ring-2 focus-visible:ring-route-cyan"
                   style={{
                     backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%235eebff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
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

               <label className="flex flex-col gap-1">
                 <span className="text-xs font-medium text-mist-blue">{t.amount}</span>
                 <input
                   type="number"
                   step="0.01"
                   inputMode="decimal"
                   autoComplete="off"
                   placeholder={`${t.amountPh} (${getFinalCurrency()})`}
                   value={amount}
                   onChange={(e) => setAmount(e.target.value)}
                   className="h-[52px] w-full appearance-none rounded-xl border border-white/10 bg-elevated-ink px-3 text-right font-mono text-2xl font-bold leading-normal tracking-tight text-cloud-white caret-route-cyan placeholder:text-base placeholder:font-sans placeholder:font-normal placeholder:text-mist-blue focus:border-route-cyan focus:outline-none focus-visible:ring-2 focus-visible:ring-route-cyan"
                 />
               </label>
             </div>

             {/* Custom Currency Input */}
             {currency === 'OTHER' && (
               <input
                 type="text"
                 placeholder="輸入幣種代碼 (如: SGD, MYR)"
                 aria-label="自訂幣種代碼"
                 value={customCurrency}
                 onChange={(e) => setCustomCurrency(e.target.value.toUpperCase())}
                 className="w-full rounded-xl border border-white/10 bg-elevated-ink p-3 text-sm text-cloud-white placeholder:text-mist-blue focus:border-route-cyan focus:outline-none"
                 maxLength={5}
               />
             )}

             {/* Exchange Rate + HKD preview — amber 匯率注意訊號 */}
             {((currency !== 'HKD' && currency !== 'OTHER') ||
               (currency === 'OTHER' && customCurrency.trim())) && (
               <div className="space-y-1 rounded-xl border border-signal-amber/30 bg-signal-amber/[0.06] p-2">
                 <div className="flex items-center gap-2">
                   <span className="whitespace-nowrap rounded-md bg-signal-amber/15 px-2 py-1 font-mono text-xs font-bold text-signal-amber">
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
                     className="min-w-0 flex-1 rounded-lg border border-white/10 bg-elevated-ink px-2 py-1.5 font-mono text-sm text-cloud-white focus:border-signal-amber focus:outline-none"
                     aria-label={`${getFinalCurrency()} 兌 HKD 匯率`}
                   />
                   <button
                     onClick={() => fetchExchangeRate(getFinalCurrency())}
                     disabled={fetchingRate}
                     className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-signal-amber/15 text-xs text-signal-amber transition-colors hover:bg-signal-amber/25 disabled:opacity-50"
                     aria-label="自動取得匯率"
                     title="自動取得匯率"
                   >
                     {fetchingRate ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                   </button>
                 </div>
                 {amount && calculateHKD() > 0 && (
                   <div className="pr-1 text-right font-mono text-xs text-signal-amber">
                     ≈ HKD ${calculateHKD().toFixed(2)}
                   </div>
                 )}
               </div>
             )}

             {/* 付款人 (default view) — 亮起現時站點 */}
             <div className="space-y-1.5">
                  <span className="text-xs text-mist-blue">{t.whoPaid}:</span>
                  <div className="flex flex-wrap gap-3 px-1 py-1.5 lg:py-3">
                    {data.members.map((m, idx) => (
                      <button
                        key={m.id}
                        onClick={() => setPayerId(m.id)}
                        className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-bold text-cloud-white transition-all ${
                          payerId === m.id
                            ? 'scale-110 border-route-cyan shadow-[0_0_14px_rgba(94,235,255,0.6)]'
                            : 'border-white/15 opacity-60 hover:scale-105 hover:opacity-100'
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
                          <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-night-asphalt bg-route-cyan text-night-asphalt">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

             {/* 調整分帳 (collapsible advanced) */}
             <details
               open={advancedOpen}
               onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
               className="group overflow-hidden rounded-xl border border-white/10 bg-elevated-ink/50"
             >
               <summary
                 className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route-cyan [&::-webkit-details-marker]:hidden"
                 aria-label="調整分帳"
               >
                 <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-cloud-white">
                   ⚙️ 調整分帳
                   <span className="truncate text-xs text-mist-blue">
                     {splitMode === 'equal' ? (participantIds.length === data.members.length ? '全員平均分' : `${participantIds.length} 人平均分`) : '自訂分帳'} · {date === todayISO ? '今日' : formatDate(date)}
                   </span>
                 </span>
                 <ChevronDown className="w-4 h-4 flex-shrink-0 text-mist-blue transition-transform group-open:rotate-180" aria-hidden="true" />
               </summary>
               <div className="space-y-3 px-3 pb-3 pt-1">

                {/* Date + Note (inner controls) */}
                <details className="group/dn overflow-hidden rounded-lg border border-white/10 bg-midnight-platform">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between rounded-lg px-3 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route-cyan [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1 truncate text-sm text-cloud-white">
                      📅 {date === todayISO ? '今日' : formatDate(date)}
                      {note && <span className="text-mist-blue"> · 📝 {note}</span>}
                    </span>
                    <ChevronDown className="ml-2 w-4 h-4 flex-shrink-0 text-mist-blue transition-transform group-open/dn:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="grid grid-cols-2 gap-3 px-3 pb-3 pt-1">
                    <label className="contents">
                      <span className="sr-only">日期</span>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="h-[44px] w-full appearance-none rounded-lg border border-white/10 bg-elevated-ink px-3 text-[14px] font-medium leading-normal text-cloud-white focus:border-route-cyan focus:outline-none"
                      />
                    </label>
                    <label className="contents">
                      <span className="sr-only">備註</span>
                      <input
                        type="text"
                        placeholder={t.notePh}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="h-[44px] w-full rounded-lg border border-white/10 bg-elevated-ink px-3 text-[14px] font-medium leading-normal text-cloud-white placeholder:text-mist-blue focus:border-route-cyan focus:outline-none"
                      />
                    </label>
                  </div>
                </details>

                {/* 誰分擔 - Avatar Style with 全選/全不選 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-mist-blue">{t.whoSplit}:</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setParticipantIds(data.members.map(m => m.id))}
                        className="min-h-11 rounded-lg bg-route-cyan/15 px-3 py-1 text-xs font-medium text-route-cyan transition-colors hover:bg-route-cyan/25"
                      >
                        {t.selectAll}
                      </button>
                      <button
                        onClick={() => setParticipantIds([])}
                        className="min-h-11 rounded-lg bg-white/5 px-3 py-1 text-xs font-medium text-mist-blue transition-colors hover:bg-white/10"
                      >
                        {t.deselectAll}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 px-1 py-3">
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
                          className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-bold text-cloud-white transition-all ${
                            isSelected
                              ? 'scale-110 border-route-cyan shadow-[0_0_12px_rgba(94,235,255,0.5)]'
                              : 'border-white/15 opacity-60 hover:scale-105 hover:opacity-100'
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
                            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-night-asphalt bg-route-cyan">
                              <Check className="h-3 w-3 text-night-asphalt" strokeWidth={3} />
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
                    <span className="whitespace-nowrap text-xs text-mist-blue">{t.splitMode}:</span>
                    <div className="flex rounded-full border border-white/10 bg-midnight-platform p-0.5" role="group" aria-label={t.splitMode}>
                      <button
                        onClick={() => {
                          setSplitMode('equal');
                          setCustomSplits({});
                        }}
                        aria-pressed={splitMode === 'equal'}
                        className={`min-h-11 whitespace-nowrap rounded-full px-3 py-1 text-xs transition-all ${
                          splitMode === 'equal'
                            ? 'bg-route-cyan font-bold text-night-asphalt'
                            : 'text-mist-blue hover:text-cloud-white'
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
                        className={`min-h-11 whitespace-nowrap rounded-full px-3 py-1 text-xs transition-all ${
                          splitMode === 'custom'
                            ? 'bg-route-cyan font-bold text-night-asphalt'
                            : 'text-mist-blue hover:text-cloud-white'
                        }`}
                      >
                        {t.customSplit}
                      </button>
                    </div>
                  </div>
                )}

                {/* Custom Split Inputs */}
                {splitMode === 'custom' && participantIds.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-white/10 bg-midnight-platform p-3">
                    <div className="mb-2 text-xs text-mist-blue">輸入各人分擔金額 (HKD):</div>
                    {participantIds.map(pid => {
                      const member = data.members.find(m => m.id === pid);
                      if (!member) return null;

                      return (
                        <div key={pid} className="flex items-center gap-2">
                          <span className="w-20 text-sm text-cloud-white">{member.name}:</span>
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
                            className="flex-1 rounded-lg border border-white/10 bg-elevated-ink p-2 font-mono text-sm text-cloud-white focus:border-route-cyan focus:outline-none"
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
                          <div className={`mt-2 font-mono text-xs ${diff <= 1 ? 'text-route-cyan' : 'text-route-magenta'}`}>
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
             </details>

             {(() => {
               const missing: string[] = [];
               if (!amount || parseFloat(amount) <= 0) missing.push('金額');
               if (!payerId) missing.push('付款人');
               if (participantIds.length === 0) missing.push('分擔者');
               const finalCur = getFinalCurrency();
               if (finalCur !== 'HKD' && !parseFloat(exchangeRates[finalCur] || '0')) missing.push('匯率');
               return missing.length > 0 ? (
                 <div className="text-center text-xs text-mist-blue">
                   仲未填：<span className="font-medium text-signal-amber">{missing.join('、')}</span>
                 </div>
               ) : null;
             })()}

             {editingExpenseId ? (
               <div className="space-y-2">
                 <button
                   onClick={handleUpdateExpense}
                   disabled={submitting}
                   className="flex w-full items-center justify-center gap-2 rounded-tl-2xl rounded-br-2xl rounded-tr-md rounded-bl-md bg-signal-amber py-3.5 text-base font-bold text-night-asphalt shadow-[0_0_20px_rgba(255,184,77,0.35)] transition-colors hover:bg-signal-amber/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-amber focus-visible:ring-offset-2 focus-visible:ring-offset-night-asphalt disabled:opacity-50"
                 >
                   {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> 更新中...</> : '更新記錄'}
                 </button>
                 <button
                   onClick={handleCancelEdit}
                   disabled={submitting}
                   className="w-full rounded-xl border border-white/10 bg-elevated-ink py-3 font-bold text-cloud-white transition-colors hover:bg-white/10 disabled:opacity-50"
                 >
                   取消編輯
                 </button>
               </div>
             ) : (
               <button
                 onClick={handleAddExpense}
                 disabled={submitting}
                 aria-label={language === 'zh' ? '記低呢筆' : t.addRecord}
                 className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-tl-2xl rounded-br-2xl rounded-tr-md rounded-bl-md bg-route-cyan py-3.5 text-base font-extrabold tracking-tight text-night-asphalt shadow-[0_0_20px_rgba(94,235,255,0.4)] transition-all hover:bg-route-cyan/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-night-asphalt disabled:opacity-50 motion-reduce:active:scale-100"
               >
                 {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> 新增中...</> : (<>{language === 'zh' ? '記低呢筆' : t.addRecord}<ArrowRight className="h-4 w-4" aria-hidden="true" /></>)}
               </button>
             )}
          </div>
          </div>

          {/* 左欄：夜行帳簿（結算方向 → 總額 → 結餘 → 記錄） */}
          <div className="lg:col-start-1 lg:row-start-3 lg:min-w-0">

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
              className="flex h-11 min-h-11 flex-grow items-center justify-center gap-2 rounded-xl bg-route-cyan font-bold text-night-asphalt transition-all hover:bg-route-cyan/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-night-asphalt motion-reduce:active:scale-100"
              aria-label="分享旅程連結，任何人有連結都可以睇同編輯"
            >
              <Share2 className="w-[18px] h-[18px]" />
              分享旅程
            </button>
            <details className="relative">
              <summary
                className="flex h-11 min-h-11 min-w-11 cursor-pointer list-none items-center justify-center gap-1 rounded-xl border border-white/10 bg-elevated-ink px-4 text-mist-blue transition-all hover:bg-white/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route-cyan [&::-webkit-details-marker]:hidden motion-reduce:active:scale-100"
                aria-label="更多操作"
              >
                更多
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-elevated-ink shadow-lg">
                <button
                  onClick={(e) => {
                    handleExportExcel();
                    e.currentTarget.closest('details')?.removeAttribute('open');
                  }}
                  className="flex h-11 min-h-11 w-full items-center gap-3 px-4 text-sm text-cloud-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route-cyan focus-visible:ring-inset"
                >
                  <FileSpreadsheet className="w-[18px] h-[18px]" />
                  匯出 Excel
                </button>
                <button
                  onClick={(e) => {
                    setShowFavoritesModal(true);
                    e.currentTarget.closest('details')?.removeAttribute('open');
                  }}
                  className="flex h-11 min-h-11 w-full items-center gap-3 px-4 text-sm text-cloud-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route-cyan focus-visible:ring-inset"
                >
                  <Star className="w-[18px] h-[18px]" />
                  收藏 App
                </button>
                <button
                  onClick={(e) => {
                    router.push('/expenses');
                    e.currentTarget.closest('details')?.removeAttribute('open');
                  }}
                  className="flex h-11 min-h-11 w-full items-center gap-3 px-4 text-sm text-cloud-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route-cyan focus-visible:ring-inset"
                >
                  <FolderPlus className="w-[18px] h-[18px]" />
                  新旅程
                </button>
              </div>
            </details>
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

          </div>

          {/* Footer Branding */}
          <div className="mt-6 mb-4 text-center lg:col-span-2">
            <a
              href="https://www.instagram.com/midlife_ai_hk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-mist-blue transition-colors hover:text-cloud-white"
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
