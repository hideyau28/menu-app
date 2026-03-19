"use client";

import { Suspense, useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createTrip,
  getTripByCode,
  addExpense,
  deleteExpense,
  updateExpense,
} from "./actions";
import { toast, Toaster } from "sonner";
import * as XLSX from "xlsx";
import {
  Star,
  FileSpreadsheet,
  Share2,
  FolderPlus,
  RotateCw,
  ChevronDown,
  Check,
  Copy,
  Loader2,
  Trash2,
} from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { enUS, zhTW } from "date-fns/locale";

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
  dining: "#3b82f6", // blue
  transport: "#f97316", // orange
  hotel: "#a855f7", // purple
  shopping: "#ec4899", // pink
  activity: "#10b981", // green
  other: "#6b7280", // gray
};

const CURRENCIES = [
  { code: "HKD", label: "HKD 港幣", flag: "🇭🇰" },
  { code: "JPY", label: "JPY", flag: "🇯🇵" },
  { code: "USD", label: "USD", flag: "🇺🇸" },
  { code: "CNY", label: "CNY", flag: "🇨🇳" },
  { code: "EUR", label: "EUR", flag: "🇪🇺" },
  { code: "GBP", label: "GBP", flag: "🇬🇧" },
  { code: "CAD", label: "CAD", flag: "🇨🇦" },
  { code: "KRW", label: "KRW", flag: "🇰🇷" },
  { code: "TWD", label: "TWD", flag: "🇹🇼" },
  { code: "THB", label: "THB", flag: "🇹🇭" },
  { code: "AUD", label: "AUD", flag: "🇦🇺" },
  { code: "OTHER", label: "其他幣種...", flag: "🌍" },
] as const;

const AVATAR_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#14b8a6", // teal
  "#f97316", // orange
  "#06b6d4", // cyan
];

const getAvatarColor = (index: number) => {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
};

const getAvatarText = (name: string) => {
  if (!name) return "?";

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
  const [currency, setCurrency] = useState<string>("HKD");
  const [customCurrency, setCustomCurrency] = useState("");
  const [exchangeRates, setExchangeRates] = useState<Record<string, string>>(
    {},
  );
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});

  // Editing State
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // UI States
  const [submitting, setSubmitting] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [recentTrips, setRecentTrips] = useState<
    Array<{ code: string; name: string; date: string }>
  >([]);
  const [fetchingRate, setFetchingRate] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Accordion States
  const [balancesExpanded, setBalancesExpanded] = useState(false);
  const [settlementsExpanded, setSettlementsExpanded] = useState(false);
  const [recordsExpanded, setRecordsExpanded] = useState(true);

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
    if (type === "success") {
      toast.success(msg, {
        duration: 2000,
        style: {
          background: "#10b981",
          color: "white",
          border: "none",
        },
      });
    } else {
      toast.error(msg, {
        duration: 3000,
        style: {
          background: "#ef4444",
          color: "white",
          border: "none",
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
            title: data?.name || "旅程記帳",
            text: "一起來記帳吧！",
            url: window.location.href,
          });
          showToast("已分享");
          return;
        } catch (err) {
          // User cancelled or share failed, fall through to clipboard
          if ((err as Error).name === "AbortError") return; // User cancelled
        }
      }

      // Fallback to clipboard
      navigator.clipboard
        .writeText(window.location.href)
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
            setPayerId((prev) => prev || res.members[0].id);
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
    if (typeof window !== "undefined") {
      const savedRates = localStorage.getItem("tripUtility_exchangeRates");
      if (savedRates) {
        try {
          setExchangeRates(JSON.parse(savedRates));
        } catch (e) {
          console.error("Failed to parse exchange rates:", e);
        }
      }
      // #9: Load recent trips
      const saved = localStorage.getItem("tripUtility_recentTrips");
      if (saved) {
        try {
          setRecentTrips(JSON.parse(saved));
        } catch {}
      }
    }
  }, []);

  // #9: Save current trip to recent trips list
  useEffect(() => {
    if (data && typeof window !== "undefined") {
      const entry = {
        code: data.code,
        name: data.name,
        date: new Date().toISOString().slice(0, 10),
      };
      setRecentTrips((prev) => {
        const filtered = prev.filter((t) => t.code !== data.code);
        const updated = [entry, ...filtered].slice(0, 10);
        localStorage.setItem(
          "tripUtility_recentTrips",
          JSON.stringify(updated),
        );
        return updated;
      });
    }
  }, [data?.code]);

  // Save exchange rates to localStorage whenever it changes
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      Object.keys(exchangeRates).length > 0
    ) {
      localStorage.setItem(
        "tripUtility_exchangeRates",
        JSON.stringify(exchangeRates),
      );
    }
  }, [exchangeRates]);

  // Reset custom splits when participants change or split mode changes
  // Fix #2: Use functional update to avoid stale closure
  useEffect(() => {
    if (splitMode === "custom" && participantIds.length > 0) {
      setCustomSplits((prev) => {
        const newSplits: Record<string, string> = {};
        participantIds.forEach((id) => {
          newSplits[id] = prev[id] || "";
        });
        return newSplits;
      });
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
  // Fix #10: Added input sanitization
  const handleCreateTrip = async () => {
    const trimmedName = tripName.trim();
    const members = memberNames.map((n) => n.trim()).filter(Boolean);

    if (!trimmedName || members.length < 2) {
      showToast("請輸入旅程名稱及最少 2 位成員", "error");
      return;
    }

    if (trimmedName.length > 50) {
      showToast("旅程名稱最多 50 字", "error");
      return;
    }

    if (members.some((m) => m.length > 20)) {
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
    if (currency === "OTHER") {
      return customCurrency.trim() || "OTHER";
    }
    return currency;
  };

  // 輔助函數：計算 HKD 金額
  const calculateHKD = () => {
    if (!amount) return 0;
    const finalCurrency = getFinalCurrency();

    if (finalCurrency === "HKD") {
      return parseFloat(amount);
    }

    const rate = parseFloat(exchangeRates[finalCurrency] || "0");
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

    // Fix #3: Validate NaN and non-positive amounts
    if (isNaN(amountValue) || amountValue <= 0) {
      showToast("請輸入有效金額", "error");
      return;
    }

    // Validate exchange rate for non-HKD currencies
    if (finalCurrency !== "HKD") {
      const rate = parseFloat(exchangeRates[finalCurrency] || "0");
      if (!rate || rate === 0) {
        showToast(`請先輸入 ${finalCurrency} 的匯率`, "error");
        return;
      }
    }

    const amountHKD =
      finalCurrency === "HKD"
        ? amountValue
        : amountValue * parseFloat(exchangeRates[finalCurrency] || "0");

    // Validate custom splits
    if (splitMode === "custom") {
      const splitTotal = Object.values(customSplits).reduce(
        (sum, val) => sum + (parseFloat(val) || 0),
        0,
      );
      const diff = Math.abs(amountHKD - splitTotal);

      if (diff > 1) {
        showToast(`分擔金額總和不正確 (差額: $${diff.toFixed(1)})`, "error");
        return;
      }

      // Check all participants have amounts
      const hasEmptySplits = participantIds.some(
        (pid) => !customSplits[pid] || parseFloat(customSplits[pid]) === 0,
      );
      if (hasEmptySplits) {
        showToast("請輸入所有參與者的分擔金額", "error");
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
        customSplits: splitMode === "custom" ? customSplits : undefined,
      });

      // #2: Auto-expand the date of the newly added expense
      setExpandedDates((prev) =>
        prev.includes(date) ? prev : [...prev, date],
      );

      setAmount("");
      setNote("");
      setCurrency("HKD"); // Reset to HKD
      setCustomCurrency(""); // Clear custom currency
      setSplitMode("equal"); // Reset split mode
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
  const handleEdit = (expense: NonNullable<typeof data>["expenses"][0]) => {
    if (!data) return;
    setEditingExpenseId(expense.id);

    // 填入基本資訊
    setCategory(expense.category || "dining");
    setDate(expense.date);
    setNote(expense.note || "");

    // 填入金額和幣種
    const originalAmount = expense.originalAmount || expense.amountHKD;
    const originalCurrency = expense.originalCurrency || "HKD";
    setAmount(originalAmount.toString());

    // Check if currency is in predefined list
    const isPredefinedCurrency = CURRENCIES.some(
      (c) => c.code === originalCurrency,
    );
    if (isPredefinedCurrency) {
      setCurrency(originalCurrency);
      setCustomCurrency("");
    } else {
      setCurrency("OTHER");
      setCustomCurrency(originalCurrency);
    }

    // 填入付款人
    setPayerId(expense.payerId);

    // 解析參與者
    const participantIdList = expense.participants.map((p) =>
      typeof p === "string" ? p : p.id,
    );
    setParticipantIds(participantIdList);

    // 檢查是否有自訂分擔
    const hasCustomSplits = expense.participants.some(
      (p) => typeof p === "object" && p.customAmount !== undefined,
    );

    if (hasCustomSplits) {
      setSplitMode("custom");
      const splits: Record<string, string> = {};
      expense.participants.forEach((p) => {
        if (typeof p === "object" && p.customAmount !== undefined) {
          splits[p.id] = p.customAmount.toString();
        }
      });
      setCustomSplits(splits);
    } else {
      setSplitMode("equal");
      setCustomSplits({});
    }

    // 滾動到表單頂部
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast("編輯模式");
  };

  // 7. 取消編輯 (Cancel Edit)
  const handleCancelEdit = () => {
    setEditingExpenseId(null);
    setAmount("");
    setNote("");
    setCurrency("HKD");
    setCustomCurrency(""); // Clear custom currency
    setSplitMode("equal");
    setCustomSplits({});
    if (data) {
      setParticipantIds(data.members.map((m) => m.id));
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

    // Fix #3: Validate NaN and non-positive amounts
    if (isNaN(amountValue) || amountValue <= 0) {
      showToast("請輸入有效金額", "error");
      return;
    }

    // Validate exchange rate for non-HKD currencies
    if (finalCurrency !== "HKD") {
      const rate = parseFloat(exchangeRates[finalCurrency] || "0");
      if (!rate || rate === 0) {
        showToast(`請先輸入 ${finalCurrency} 的匯率`, "error");
        return;
      }
    }

    const amountHKD =
      finalCurrency === "HKD"
        ? amountValue
        : amountValue * parseFloat(exchangeRates[finalCurrency] || "0");

    // 驗證自訂分擔
    if (splitMode === "custom") {
      const splitTotal = Object.values(customSplits).reduce(
        (sum, val) => sum + (parseFloat(val) || 0),
        0,
      );
      const diff = Math.abs(amountHKD - splitTotal);

      if (diff > 1) {
        showToast(`分擔金額總和不正確 (差額: $${diff.toFixed(1)})`, "error");
        return;
      }

      const hasEmptySplits = participantIds.some(
        (pid) => !customSplits[pid] || parseFloat(customSplits[pid]) === 0,
      );
      if (hasEmptySplits) {
        showToast("請輸入所有參與者的分擔金額", "error");
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
        customSplits: splitMode === "custom" ? customSplits : undefined,
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

  // 9. 刪除當前編輯中的支出 (Delete Current Editing Expense)
  const handleDeleteCurrentExpense = async () => {
    if (!data || !editingExpenseId) return;

    // Find the expense to show details in confirmation
    const expense = data.expenses.find((e) => e.id === editingExpenseId);
    if (!expense) return;

    const confirmMsg = [
      "確定刪除此記錄?",
      "",
      `📝 ${expense.title}`,
      `💰 HKD $${expense.amountHKD.toFixed(1)}`,
      `📅 ${expense.date}`,
      `👤 ${expense.payerName}`,
    ].join("\n");

    // Fix #9: Use custom modal
    setConfirmModal({
      message: confirmMsg,
      onConfirm: async () => {
        try {
          await deleteExpense(data!.code, editingExpenseId!);
          handleCancelEdit();
          await reloadTrip();
          showToast("已刪除", "success");
        } catch (e) {
          console.error(e);
          showToast("刪除失敗", "error");
        }
      },
    });
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
        "日期",
        "種類",
        "備註",
        "貨幣",
        "原幣金額",
        "折算港幣(HKD)",
        "付款人",
        ...data.members.map((m) => m.name), // Dynamic member columns
      ];

      const transactionRows = data.expenses.map((e) => {
        const row: any[] = [
          e.date,
          CATEGORIES.find((c) => c.id === e.category)?.label || "其他",
          e.note || "",
          e.originalCurrency || "HKD",
          e.originalAmount || e.amountHKD,
          e.amountHKD,
          e.payerName,
        ];

        // Add split amounts for each member
        data.members.forEach((member) => {
          const participant = e.participants.find((p) => {
            const memberId = typeof p === "string" ? p : p.id;
            return memberId === member.id;
          });

          if (participant) {
            // Check if custom split exists
            const customAmount =
              typeof participant === "object"
                ? participant.customAmount
                : undefined;
            const share =
              customAmount !== undefined
                ? customAmount
                : e.amountHKD / e.participants.length;
            row.push(share);
          } else {
            row.push(0);
          }
        });

        return row;
      });

      const ws1 = XLSX.utils.aoa_to_sheet([
        transactionHeaders,
        ...transactionRows,
      ]);

      // Sheet 2: 結餘狀況 (Balances)
      const balanceHeaders = [
        "姓名",
        "代墊金額 (Paid)",
        "消費金額 (Share)",
        "淨結餘 (Balance)",
      ];
      const balanceRows = data.members.map((member) => {
        // Calculate total paid
        const totalPaid = data.expenses
          .filter((e) => e.payerId === member.id)
          .reduce((sum, e) => sum + e.amountHKD, 0);

        // Calculate total share
        const totalShare = data.expenses
          .filter((e) =>
            e.participants.some((p) => {
              const memberId = typeof p === "string" ? p : p.id;
              return memberId === member.id;
            }),
          )
          .reduce((sum, e) => {
            const participant = e.participants.find((p) => {
              const memberId = typeof p === "string" ? p : p.id;
              return memberId === member.id;
            });

            if (!participant) return sum;

            const customAmount =
              typeof participant === "object"
                ? participant.customAmount
                : undefined;
            const share =
              customAmount !== undefined
                ? customAmount
                : e.amountHKD / e.participants.length;

            return sum + share;
          }, 0);

        const balance = totalPaid - totalShare;

        return [member.name, totalPaid, totalShare, balance];
      });

      const ws2 = XLSX.utils.aoa_to_sheet([balanceHeaders, ...balanceRows]);

      // Sheet 3: 建議還款 (Repayments)
      const repaymentHeaders = ["付款人 (From)", "收款人 (To)", "金額 (HKD)"];
      const repaymentRows = settlements.map((s) => [s.from, s.to, s.amount]);

      const ws3 = XLSX.utils.aoa_to_sheet([repaymentHeaders, ...repaymentRows]);

      // Create workbook and add sheets
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, "交易紀錄");
      XLSX.utils.book_append_sheet(wb, ws2, "結餘狀況");
      XLSX.utils.book_append_sheet(wb, ws3, "建議還款");

      // Generate filename with timestamp
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, "-");
      const filename = `${data.name}_Report_${timestamp}.xlsx`;

      // Write file
      XLSX.writeFile(wb, filename);

      showToast("Excel 已匯出", "success");
    } catch (error) {
      console.error("Export error:", error);
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
        const memberId =
          typeof participant === "string" ? participant : participant.id;

        if (bal[memberId] !== undefined) {
          // Check if custom split exists
          const customAmount =
            typeof participant === "object"
              ? participant.customAmount
              : undefined;
          const share =
            customAmount !== undefined
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
    const transactions: Array<{ from: string; to: string; amount: number }> =
      [];
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
    const groups = data.expenses.reduce(
      (acc, expense) => {
        const date = expense.date;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(expense);
        return acc;
      },
      {} as Record<string, typeof data.expenses>,
    );

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

  // Auto-expand the latest date group when data first loads
  useEffect(() => {
    if (expensesByDate.length > 0) {
      const latestDate = expensesByDate[0].date;
      setExpandedDates((prev) =>
        prev.includes(latestDate) ? prev : [latestDate],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.code]); // Only run when trip changes, not on every expense update

  // Format date for display - Localized
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, language === "en" ? "MMM d" : "M月d日", {
      locale: language === "en" ? enUS : zhTW,
    });
  };

  // #10: Auto-fetch exchange rate
  const fetchExchangeRate = async (currencyCode: string) => {
    if (!currencyCode || currencyCode === "HKD" || currencyCode === "OTHER")
      return;
    setFetchingRate(true);
    try {
      const res = await fetch(
        `https://api.exchangerate-api.com/v4/latest/${currencyCode}`,
      );
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const rate = data.rates?.HKD;
      if (rate) {
        setExchangeRates((prev) => ({
          ...prev,
          [currencyCode]: rate.toString(),
        }));
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
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-6xl animate-bounce">✈️</div>
          <div className="text-lg font-bold mb-2">旅程記帳</div>
          <div className="flex items-center gap-2 text-gray-500">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <div
              className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"
              style={{ animationDelay: "0.2s" }}
            />
            <div
              className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"
              style={{ animationDelay: "0.4s" }}
            />
          </div>
        </div>
      </div>
    );
  }

  // 情況 B: 有 code 但找不到資料 -> 顯示錯誤
  if (code && !data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center px-4">
          <div className="mb-4 flex justify-center">
            <RotateCw className="w-12 h-12 text-blue-500" />
          </div>
          <div className="text-gray-300 font-medium mb-1">搵唔到呢個旅程</div>
          <div className="text-sm text-gray-500 mb-6 font-mono">
            Code: {code}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-blue-600 rounded-xl hover:bg-blue-500 transition-colors font-medium"
          >
            重新載入
          </button>
          <button
            onClick={() => router.push("/expenses")}
            className="mt-4 px-8 py-3 border border-gray-600 text-gray-400 rounded-xl hover:bg-gray-800 hover:scale-105 active:scale-95 transition-all block w-full max-w-xs mx-auto"
          >
            建立新旅程
          </button>
        </div>
      </div>
    );
  }

  // 情況 C: 沒有 code -> 顯示「建立新旅程」
  if (!code) {
    return (
      <div className="min-h-screen bg-black p-4 pt-10 text-white pb-24 relative overflow-hidden">
        {/* Animated background orbs */}
        <div
          className="fixed top-10 -left-24 w-72 h-72 rounded-full pointer-events-none animate-pulse-glow"
          style={{
            background: "radial-gradient(circle, #3b82f6 0%, transparent 65%)",
          }}
        />
        <div
          className="fixed top-1/3 -right-20 w-64 h-64 rounded-full pointer-events-none animate-pulse-glow"
          style={{
            background: "radial-gradient(circle, #8b5cf6 0%, transparent 65%)",
            animationDelay: "1s",
          }}
        />
        <div
          className="fixed bottom-24 left-1/4 w-48 h-48 rounded-full pointer-events-none animate-pulse-glow"
          style={{
            background: "radial-gradient(circle, #06b6d4 0%, transparent 65%)",
            animationDelay: "2s",
          }}
        />

        <Toaster
          position="bottom-center"
          theme="dark"
          richColors
          expand={false}
        />

        <div className="max-w-md mx-auto relative">
          {/* Hero Header */}
          <div className="text-center mb-10 animate-fade-in-up">
            <div
              className="text-7xl mb-4 inline-block animate-float"
              style={{ filter: "drop-shadow(0 0 30px rgba(59,130,246,0.5))" }}
            >
              ✈️
            </div>
            <h1
              className="text-4xl font-black tracking-tight mb-2"
              style={{
                background:
                  "linear-gradient(135deg, #fff 0%, #93c5fd 50%, #c4b5fd 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              旅程記帳
            </h1>
            <p className="text-gray-500 text-sm">多人分帳，輕鬆搞掂</p>
          </div>

          {/* Join Card */}
          <div
            className="rounded-3xl p-5 mb-4 border border-blue-500/20 animate-fade-in-up"
            style={{
              background:
                "linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.05) 100%)",
              animationDelay: "0.1s",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-sm">
                🔗
              </div>
              <span className="text-sm font-semibold text-blue-300">
                加入現有旅程
              </span>
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 p-3 bg-black/60 rounded-2xl border border-gray-700/80 text-center tracking-[0.3em] uppercase font-mono text-white placeholder:text-gray-600 focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="輸入旅程碼"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={8}
                onKeyDown={(e) => e.key === "Enter" && handleJoinTrip()}
              />
              <button
                onClick={handleJoinTrip}
                className="px-5 py-3 bg-blue-600 rounded-2xl font-bold hover:bg-blue-500 active:scale-95 transition-all"
              >
                加入
              </button>
            </div>
          </div>

          {/* Recent trips */}
          {recentTrips.length > 0 && (
            <div
              className="mb-4 animate-fade-in-up"
              style={{ animationDelay: "0.15s" }}
            >
              <div className="text-xs text-gray-500 font-medium mb-2 px-1">
                最近旅程
              </div>
              <div className="space-y-2">
                {recentTrips.slice(0, 3).map((trip) => (
                  <button
                    key={trip.code}
                    onClick={() => router.push(`/expenses?code=${trip.code}`)}
                    className="w-full flex items-center justify-between p-3 bg-[#1c1c1e]/80 rounded-2xl border border-gray-800 hover:border-gray-600 hover:bg-gray-800/60 active:scale-[0.98] transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600/30 to-purple-600/30 flex items-center justify-center text-sm">
                        ✈️
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{trip.name}</div>
                        <div className="text-[11px] text-gray-500 font-mono tracking-wider">
                          {trip.code}
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-600">{trip.date}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          <div
            className="flex items-center gap-3 my-5 animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="flex-1 border-t border-gray-800/80" />
            <span className="text-gray-600 text-xs px-2">或者建立新旅程</span>
            <div className="flex-1 border-t border-gray-800/80" />
          </div>

          {/* Create Card */}
          <div
            className="rounded-3xl p-5 border border-gray-800/80 bg-[#111] animate-fade-in-up"
            style={{ animationDelay: "0.25s" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center text-sm">
                🗺️
              </div>
              <span className="text-sm font-semibold text-gray-300">
                建立新旅程
              </span>
            </div>

            <input
              className="w-full p-4 bg-black/70 rounded-2xl mb-4 border border-gray-800 text-white placeholder:text-gray-600 focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="旅程名稱（如：東京五日遊）"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
            />

            {/* Member avatar preview */}
            {memberNames.some((n) => n.trim()) && (
              <div className="flex gap-2 mb-3 px-1 flex-wrap">
                {memberNames
                  .filter((n) => n.trim())
                  .map((n, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white/10"
                        style={{ backgroundColor: getAvatarColor(i) }}
                      >
                        {getAvatarText(n.trim())}
                      </div>
                      <span className="text-[9px] text-gray-500 max-w-[36px] truncate">
                        {n.trim()}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            <div className="space-y-2 mb-4">
              {memberNames.map((n, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="flex-1 p-3.5 bg-black/70 rounded-2xl border border-gray-800 text-white placeholder:text-gray-600 focus:border-blue-500 focus:outline-none transition-colors"
                    placeholder={`成員 ${i + 1} 名稱`}
                    value={n}
                    onChange={(e) => {
                      const next = [...memberNames];
                      next[i] = e.target.value;
                      setMemberNames(next);
                    }}
                  />
                  {memberNames.length > 2 && (
                    <button
                      onClick={() =>
                        setMemberNames(
                          memberNames.filter((_, idx) => idx !== i),
                        )
                      }
                      className="px-3.5 py-3 bg-black/70 rounded-2xl border border-gray-800 text-red-400 hover:bg-red-900/20 active:scale-95 transition-all"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setMemberNames([...memberNames, ""])}
                className="px-4 py-3 bg-black/70 rounded-2xl border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 active:scale-95 transition-all text-sm font-medium"
              >
                + 加成員
              </button>
              <button
                onClick={handleCreateTrip}
                disabled={submitting}
                className="flex-1 py-3 rounded-2xl font-bold disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                style={{
                  background:
                    "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
                  boxShadow: "0 4px 24px rgba(37,99,235,0.35)",
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> 建立中...
                  </>
                ) : (
                  "🚀 出發！"
                )}
              </button>
            </div>
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
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
          <div className="bg-[#2c2c2e] rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-5 text-center whitespace-pre-line text-sm">
              {confirmModal.message}
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
        <div className="mb-6">
          {/* Action Buttons Row */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleShareLink}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600/20 border border-blue-500/30 rounded-2xl text-blue-400 hover:bg-blue-600/30 transition-all active:scale-95 text-xs font-medium"
            >
              <Share2 className="w-4 h-4 flex-shrink-0" />
              <span>分享</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#1c1c1e] border border-gray-800 rounded-2xl text-gray-300 hover:bg-gray-800 transition-all active:scale-95 text-xs font-medium"
            >
              <FileSpreadsheet className="w-4 h-4 flex-shrink-0" />
              <span>匯出</span>
            </button>
            <button
              onClick={() => router.push("/expenses")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#1c1c1e] border border-gray-800 rounded-2xl text-gray-300 hover:bg-gray-800 transition-all active:scale-95 text-xs font-medium"
            >
              <FolderPlus className="w-4 h-4 flex-shrink-0" />
              <span>新旅程</span>
            </button>
            <button
              onClick={reloadTrip}
              className="flex-none flex items-center justify-center w-10 py-2.5 bg-[#1c1c1e] border border-gray-800 rounded-2xl text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-all active:scale-95"
              title="重新整理"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowFavoritesModal(true)}
              className="flex-none flex items-center justify-center w-10 py-2.5 bg-[#1c1c1e] border border-gray-800 rounded-2xl text-gray-500 hover:bg-gray-800 hover:text-yellow-400 transition-all active:scale-95"
              title="收藏此 App"
            >
              <Star className="w-4 h-4" />
            </button>
          </div>
          {/* Hero Title */}
          <div className="mb-5 animate-fade-in-up">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h1
                className="text-3xl font-black tracking-tight leading-tight"
                style={{
                  background: "linear-gradient(135deg, #fff 0%, #93c5fd 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {data.name}
              </h1>
              <button
                onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
                className="flex-shrink-0 mt-1 text-xs font-bold border border-gray-700 rounded-full px-3 py-1 hover:bg-gray-800 hover:border-gray-500 transition-all text-gray-400"
              >
                {language === "zh" ? "EN" : "中"}
              </button>
            </div>
            {/* Trip code pill */}
            <button
              onClick={() => {
                navigator.clipboard
                  .writeText(data.code)
                  .then(() => showToast("旅程碼已複製"))
                  .catch(() => {});
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all active:scale-95"
            >
              <span className="text-[11px] font-mono tracking-[0.25em] text-gray-400">
                {data.code}
              </span>
              <Copy className="w-3 h-3 text-gray-600" />
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
                  <div className="font-semibold text-white mb-2">
                    📱 iOS（推薦）：
                  </div>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>
                      點擊下方「分享」按鈕{" "}
                      <span className="text-blue-400">(↑)</span>
                    </li>
                    <li>選擇「加入主畫面」</li>
                    <li>或選擇「加入我的最愛」</li>
                  </ol>
                </div>
                <div>
                  <div className="font-semibold text-white mb-2">
                    🤖 Android：
                  </div>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>
                      點擊瀏覽器選單 <span className="text-blue-400">(⋮)</span>
                    </li>
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
        <div
          className="mb-6 p-6 rounded-3xl shadow-lg border border-gray-700/50 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          }}
        >
          {/* Subtle glow orb */}
          <div
            className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-20"
            style={{
              background:
                "radial-gradient(circle, #3b82f6 0%, transparent 70%)",
            }}
          />
          <div className="relative">
            <div className="text-blue-300/70 text-sm mb-1">
              {t.totalExpense}
            </div>
            <div className="text-4xl font-extrabold text-white tracking-tight">
              <span className="text-blue-300/60 text-2xl mr-1">HKD</span>
              {data.expenses
                .reduce((s, e) => s + e.amountHKD, 0)
                .toLocaleString("en", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
            </div>
            {/* Per-person average + record count */}
            {data.members.length > 0 && data.expenses.length > 0 && (
              <div className="flex gap-3 mt-2 text-sm text-blue-200/50">
                <span>
                  👤 人均 ≈ $
                  {(
                    data.expenses.reduce((s, e) => s + e.amountHKD, 0) /
                    data.members.length
                  ).toFixed(1)}
                </span>
                <span>📝 {data.expenses.length} 筆</span>
              </div>
            )}

            {/* Rainbow Proportion Bar + Category Legend */}
            {data.expenses.length > 0 &&
              (() => {
                const total = data.expenses.reduce(
                  (s, e) => s + e.amountHKD,
                  0,
                );
                if (total === 0) return null;

                const categoryTotals = CATEGORIES.map((cat) => ({
                  id: cat.id,
                  label: cat.label,
                  icon: cat.icon,
                  amount: data.expenses
                    .filter((e) => e.category === cat.id)
                    .reduce((s, e) => s + e.amountHKD, 0),
                })).filter((c) => c.amount > 0);

                if (categoryTotals.length === 0) return null;

                return (
                  <div className="mt-4">
                    <div className="flex h-2.5 rounded-full overflow-hidden mb-3">
                      {categoryTotals.map((cat) => (
                        <div
                          key={cat.id}
                          style={{
                            width: `${(cat.amount / total) * 100}%`,
                            backgroundColor:
                              CATEGORY_COLORS[cat.id] || "#6b7280",
                          }}
                          className="transition-all duration-500"
                        />
                      ))}
                    </div>
                    {/* Category Legend */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {categoryTotals.map((cat) => (
                        <div
                          key={cat.id}
                          className="flex items-center gap-1 text-xs text-gray-400"
                        >
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: CATEGORY_COLORS[cat.id] }}
                          />
                          <span>
                            {cat.icon} {cat.label}
                          </span>
                          <span className="text-gray-600">
                            {((cat.amount / total) * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
          </div>
        </div>

        {/* Add Expense Form - Moved to top */}
        <div
          ref={formRef}
          className={`p-5 rounded-3xl border mb-8 space-y-4 transition-all ${
            editingExpenseId
              ? "bg-[#1a1a2e] border-yellow-600/50 ring-1 ring-yellow-600/30"
              : "bg-[#1c1c1e] border-gray-800"
          }`}
        >
          {/* #3: Edit mode banner */}
          {editingExpenseId && (
            <div className="flex items-center justify-between bg-yellow-600/20 text-yellow-400 text-xs font-bold px-3 py-2 rounded-lg -mt-1">
              <span>✏️ 編輯模式</span>
              <button
                onClick={handleCancelEdit}
                className="text-gray-400 hover:text-white"
              >
                ✕ 取消
              </button>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => {
              const color = CATEGORY_COLORS[c.id] || "#6b7280";
              const isSelected = category === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`h-[52px] p-2 rounded-xl border-2 transition-all text-white flex flex-col items-center justify-center ${
                    isSelected ? "font-bold scale-105" : "hover:scale-105"
                  }`}
                  style={{
                    borderColor: color,
                    backgroundColor: isSelected ? color : "transparent",
                  }}
                >
                  <span className="text-lg">{c.icon}</span>
                  <span className="text-[11px] leading-tight mt-1 px-1 text-center">
                    {t[c.id as keyof typeof t] || c.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Currency Pill Selector */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
            {CURRENCIES.map((c) => {
              const isSelected = currency === c.code;
              return (
                <button
                  key={c.code}
                  onClick={() => {
                    setCurrency(c.code);
                    if (c.code !== "OTHER") setCustomCurrency("");
                  }}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-medium transition-all active:scale-95 ${
                    isSelected
                      ? "border-blue-500 bg-blue-500/20 text-blue-300"
                      : "border-gray-800 bg-black/50 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <span>{c.flag}</span>
                  <span>{c.code === "OTHER" ? "其他" : c.code}</span>
                </button>
              );
            })}
          </div>

          {/* Custom Currency Input */}
          {currency === "OTHER" && (
            <input
              type="text"
              placeholder="輸入幣種代碼 (如: SGD, MYR)"
              value={customCurrency}
              onChange={(e) => setCustomCurrency(e.target.value.toUpperCase())}
              className="w-full p-3 bg-black rounded-xl border border-gray-800 text-sm placeholder:text-gray-600 focus:border-blue-600 focus:outline-none"
              maxLength={5}
            />
          )}

          {/* Amount + Date + Note Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Amount Input */}
            <input
              type="number"
              step="0.01"
              placeholder={`${t.amountPh} (${getFinalCurrency()})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 h-[52px] bg-black rounded-xl border border-gray-800 focus:border-blue-600 focus:outline-none appearance-none text-[15px] font-medium leading-normal placeholder:text-gray-500"
            />

            {/* Date Picker */}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 h-[52px] bg-black rounded-xl border border-gray-800 focus:border-blue-600 focus:outline-none appearance-none text-[15px] font-medium leading-normal placeholder:text-gray-500"
            />

            {/* Notes Input (full width) */}
            <input
              type="text"
              placeholder={t.notePh}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="col-span-2 w-full px-3 h-[52px] bg-black rounded-xl border border-gray-800 focus:border-blue-600 focus:outline-none text-[15px] font-medium leading-normal placeholder:text-gray-500"
            />
          </div>

          {/* Exchange Rate Input (shown for non-HKD currencies) */}
          {((currency !== "HKD" && currency !== "OTHER") ||
            (currency === "OTHER" && customCurrency.trim())) && (
            <div className="flex items-center gap-2 bg-black px-3 py-2 rounded-xl border border-gray-800">
              <span className="text-xs text-gray-400 whitespace-nowrap">
                匯率 ({getFinalCurrency()} → HKD):
              </span>
              <input
                type="number"
                step="0.000001"
                placeholder="0.000000"
                value={exchangeRates[getFinalCurrency()] || ""}
                onChange={(e) => {
                  const code = getFinalCurrency();
                  setExchangeRates((prev) => ({
                    ...prev,
                    [code]: e.target.value,
                  }));
                }}
                className="flex-1 p-2 bg-[#1c1c1e] rounded-lg border border-gray-700 text-sm focus:border-blue-600 focus:outline-none"
              />
              {/* #10: Auto-fetch button */}
              <button
                onClick={() => fetchExchangeRate(getFinalCurrency())}
                disabled={fetchingRate}
                className="px-2 py-2 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {fetchingRate ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  "⚡ 自動"
                )}
              </button>
            </div>
          )}

          {/* HKD Conversion Display */}
          {getFinalCurrency() !== "HKD" && amount && calculateHKD() > 0 && (
            <div className="text-xs text-gray-400 text-center">
              ≈ HKD {calculateHKD().toFixed(2)}
            </div>
          )}

          <div className="space-y-3">
            {/* 誰付錢 - Avatar Style */}
            <div className="space-y-2">
              <span className="text-xs text-gray-500">{t.whoPaid}:</span>
              <div className="flex flex-nowrap gap-3 overflow-x-auto overflow-y-hidden scrollbar-hide px-1 py-2">
                {data.members.map((m, idx) => (
                  <button
                    key={m.id}
                    onClick={() => setPayerId(m.id)}
                    className={`relative flex-shrink-0 flex flex-col items-center gap-1 transition-all ${
                      payerId === m.id
                        ? "scale-110"
                        : "opacity-60 hover:opacity-100 hover:scale-105"
                    }`}
                    title={m.name}
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                        payerId === m.id
                          ? "border-white shadow-lg shadow-blue-500/50"
                          : "border-gray-700"
                      }`}
                      style={{ backgroundColor: getAvatarColor(idx) }}
                    >
                      {getAvatarText(m.name)}
                      {payerId === m.id && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-black flex items-center justify-center text-xs">
                          ✓
                        </div>
                      )}
                    </div>
                    <span
                      className={`text-[10px] max-w-[52px] truncate ${payerId === m.id ? "text-white font-medium" : "text-gray-500"}`}
                    >
                      {m.name}
                    </span>
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
                    onClick={() =>
                      setParticipantIds(data.members.map((m) => m.id))
                    }
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
              <div className="flex flex-nowrap gap-3 overflow-x-auto overflow-y-hidden scrollbar-hide px-1 py-2">
                {data.members.map((m, idx) => {
                  const isSelected = participantIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() =>
                        setParticipantIds((prev) =>
                          prev.includes(m.id)
                            ? prev.filter((p) => p !== m.id)
                            : [...prev, m.id],
                        )
                      }
                      className={`relative flex-shrink-0 flex flex-col items-center gap-1 transition-all ${
                        isSelected
                          ? "scale-110"
                          : "opacity-60 hover:opacity-100 hover:scale-105"
                      }`}
                      title={m.name}
                    >
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                          isSelected
                            ? "border-white ring-2 ring-offset-2 ring-offset-black ring-blue-500 shadow-lg shadow-blue-500/50"
                            : "border-gray-700"
                        }`}
                        style={{ backgroundColor: getAvatarColor(idx) }}
                      >
                        {getAvatarText(m.name)}
                        {isSelected && (
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-black flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-[10px] max-w-[52px] truncate ${isSelected ? "text-white font-medium" : "text-gray-500"}`}
                      >
                        {m.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Split Mode Toggle */}
            {participantIds.length > 0 && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {t.splitMode}:
                </span>
                <button
                  onClick={() => {
                    setSplitMode("equal");
                    setCustomSplits({});
                  }}
                  className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap transition-all ${
                    splitMode === "equal"
                      ? "bg-blue-600 border-blue-600 text-white font-bold"
                      : "border-gray-700 text-gray-400 hover:bg-gray-800"
                  }`}
                >
                  {t.equalSplit}
                </button>
                <button
                  onClick={() => {
                    setSplitMode("custom");
                    const newSplits: Record<string, string> = {};
                    participantIds.forEach((id) => {
                      newSplits[id] = "";
                    });
                    setCustomSplits(newSplits);
                  }}
                  className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap transition-all ${
                    splitMode === "custom"
                      ? "bg-blue-600 border-blue-600 text-white font-bold"
                      : "border-gray-700 text-gray-400 hover:bg-gray-800"
                  }`}
                >
                  {t.customSplit}
                </button>
              </div>
            )}

            {/* Custom Split Inputs */}
            {splitMode === "custom" && participantIds.length > 0 && (
              <div className="bg-black p-3 rounded-xl border border-gray-800 space-y-2">
                <div className="text-xs text-gray-400 mb-2">
                  輸入各人分擔金額 (HKD):
                </div>
                {participantIds.map((pid) => {
                  const member = data.members.find((m) => m.id === pid);
                  if (!member) return null;

                  return (
                    <div key={pid} className="flex items-center gap-2">
                      <span className="text-sm text-gray-300 w-20">
                        {member.name}:
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={customSplits[pid] || ""}
                        onChange={(e) => {
                          setCustomSplits((prev) => ({
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
                  const splitTotal = Object.values(customSplits).reduce(
                    (sum, val) => sum + (parseFloat(val) || 0),
                    0,
                  );
                  const diff = Math.abs(total - splitTotal);

                  if (total > 0 && splitTotal > 0) {
                    return (
                      <div
                        className={`text-xs mt-2 ${diff <= 1 ? "text-green-400" : "text-red-400"}`}
                      >
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

          {editingExpenseId ? (
            <div className="space-y-2">
              <button
                onClick={handleUpdateExpense}
                disabled={submitting}
                className="w-full py-3 bg-green-600 rounded-xl font-bold hover:bg-green-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> 更新中...
                  </>
                ) : (
                  "💾 更新記錄"
                )}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleCancelEdit}
                  disabled={submitting}
                  className="flex-1 py-3 bg-gray-700 rounded-xl font-bold hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteCurrentExpense}
                  disabled={submitting}
                  className="flex-1 py-3 bg-red-600 rounded-xl font-bold hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  🗑️ 刪除
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleAddExpense}
              disabled={submitting}
              className="w-full py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> 新增中...
                </>
              ) : (
                t.addRecord
              )}
            </button>
          )}
        </div>

        {/* Balances Section */}
        <div className="bg-[#1c1c1e] rounded-3xl border border-gray-800 overflow-hidden mb-4">
          <button
            onClick={() => setBalancesExpanded(!balancesExpanded)}
            className="w-full p-4 flex justify-between items-center hover:bg-gray-800/50 transition-colors"
          >
            <h3 className="font-bold text-gray-300">{t.balances}</h3>
            <ChevronDown
              className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${balancesExpanded ? "rotate-180" : ""}`}
            />
          </button>

          {balancesExpanded && (
            <div className="px-4 pb-4 space-y-2">
              {Object.entries(balances).map(([id, bal]) => {
                const member = data.members.find((m) => m.id === id);
                if (!member) return null;
                const memberIdx = data.members.findIndex((m) => m.id === id);

                // Calculate 總墊支 (Total Paid)
                const totalPaid = data.expenses
                  .filter((e) => e.payerId === id)
                  .reduce((sum, e) => sum + e.amountHKD, 0);

                // Calculate 總消費 (Total Consumed)
                const totalConsumed = data.expenses
                  .filter((e) =>
                    e.participants.some((p) => {
                      const memberId = typeof p === "string" ? p : p.id;
                      return memberId === id;
                    }),
                  )
                  .reduce((sum, e) => {
                    // Find this member's participant record
                    const participant = e.participants.find((p) => {
                      const memberId = typeof p === "string" ? p : p.id;
                      return memberId === id;
                    });

                    if (!participant) return sum;

                    // Check if custom split exists
                    const customAmount =
                      typeof participant === "object"
                        ? participant.customAmount
                        : undefined;
                    const share =
                      customAmount !== undefined
                        ? customAmount
                        : e.amountHKD / e.participants.length;

                    return sum + share;
                  }, 0);

                const maxAmount = Math.max(totalPaid, totalConsumed, 1);

                return (
                  <div
                    key={id}
                    className="bg-black/60 p-4 rounded-2xl border border-gray-800/60 animate-fade-in-up"
                  >
                    {/* Top row: avatar + name + net badge */}
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ring-2 ring-white/10"
                        style={{ backgroundColor: getAvatarColor(memberIdx) }}
                      >
                        {getAvatarText(member.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-white truncate block">
                          {member.name}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-black px-2.5 py-1 rounded-full ${
                          bal > 0
                            ? "bg-green-500/15 text-green-400 border border-green-500/20"
                            : bal < 0
                              ? "bg-red-500/15 text-red-400 border border-red-500/20"
                              : "bg-gray-800 text-gray-500 border border-gray-700"
                        }`}
                      >
                        {bal > 0
                          ? `+$${bal.toFixed(1)}`
                          : bal < 0
                            ? `-$${Math.abs(bal).toFixed(1)}`
                            : "$0"}
                      </span>
                    </div>
                    {/* Progress bars */}
                    <div className="space-y-2.5">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] text-gray-500 font-medium">
                            墊支
                          </span>
                          <span className="text-[11px] text-green-400 font-semibold">
                            ${totalPaid.toFixed(1)}
                          </span>
                        </div>
                        <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${(totalPaid / maxAmount) * 100}%`,
                              background:
                                "linear-gradient(90deg, #10b981 0%, #34d399 100%)",
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] text-gray-500 font-medium">
                            消費
                          </span>
                          <span className="text-[11px] text-red-400 font-semibold">
                            ${totalConsumed.toFixed(1)}
                          </span>
                        </div>
                        <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${(totalConsumed / maxAmount) * 100}%`,
                              background:
                                "linear-gradient(90deg, #ef4444 0%, #f87171 100%)",
                            }}
                          />
                        </div>
                      </div>
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
            <h3 className="font-bold text-gray-300">{t.settlements}</h3>
            <ChevronDown
              className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${settlementsExpanded ? "rotate-180" : ""}`}
            />
          </button>

          {settlementsExpanded && (
            <div className="px-4 pb-4">
              {settlements.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">🎉</div>
                  <div className="text-gray-500 text-sm">暫無須結算</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {settlements.map((s, idx) => {
                    const fromMember = data.members.find(
                      (m) => m.name === s.from,
                    );
                    const toMember = data.members.find((m) => m.name === s.to);
                    const fromIdx = fromMember
                      ? data.members.indexOf(fromMember)
                      : 0;
                    const toIdx = toMember ? data.members.indexOf(toMember) : 0;
                    return (
                      <div
                        key={idx}
                        className="bg-black/70 rounded-2xl border border-gray-800/60 p-4 animate-fade-in-up"
                        style={{ animationDelay: `${idx * 0.06}s` }}
                      >
                        {/* Amount badge */}
                        <div className="text-center mb-3">
                          <span
                            className="inline-block px-4 py-1 rounded-full text-sm font-black text-yellow-400 border border-yellow-500/30"
                            style={{ background: "rgba(234,179,8,0.08)" }}
                          >
                            HKD ${s.amount.toFixed(1)}
                          </span>
                        </div>
                        {/* From → To row */}
                        <div className="flex items-center gap-2">
                          {/* From */}
                          <div className="flex flex-col items-center gap-1 flex-1">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-red-500/30"
                              style={{
                                backgroundColor: getAvatarColor(fromIdx),
                              }}
                            >
                              {getAvatarText(s.from)}
                            </div>
                            <span className="text-xs font-medium text-red-400 truncate max-w-[60px]">
                              {s.from}
                            </span>
                          </div>
                          {/* Animated arrow */}
                          <div className="flex-1 flex items-center justify-center gap-0.5">
                            {[0, 1, 2].map((i) => (
                              <div
                                key={i}
                                className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-arrow-slide"
                                style={{ animationDelay: `${i * 0.2}s` }}
                              />
                            ))}
                            <span
                              className="text-gray-500 text-base animate-arrow-slide"
                              style={{ animationDelay: "0.4s" }}
                            >
                              ›
                            </span>
                          </div>
                          {/* To */}
                          <div className="flex flex-col items-center gap-1 flex-1">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-green-500/30"
                              style={{ backgroundColor: getAvatarColor(toIdx) }}
                            >
                              {getAvatarText(s.to)}
                            </div>
                            <span className="text-xs font-medium text-green-400 truncate max-w-[60px]">
                              {s.to}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Records List - Grouped by Date */}
        <div className="bg-[#1c1c1e] rounded-3xl border border-gray-800 overflow-hidden mb-4">
          <button
            onClick={() => setRecordsExpanded(!recordsExpanded)}
            className="w-full p-4 flex justify-between items-center hover:bg-gray-800/50 transition-colors"
          >
            <h3 className="font-bold text-gray-300">{t.recordList}</h3>
            <ChevronDown
              className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${recordsExpanded ? "rotate-180" : ""}`}
            />
          </button>

          {recordsExpanded && (
            <div className="px-4 pb-4">
              {expensesByDate.length === 0 && (
                <div className="text-center py-12 animate-fade-in">
                  <div className="text-6xl mb-4 animate-bounce-gentle inline-block">
                    📭
                  </div>
                  <div className="text-gray-400 font-medium mb-1">暫無記錄</div>
                  <div className="text-xs text-gray-600">
                    喺上面新增第一筆支出吧！
                  </div>
                </div>
              )}

              {/* Date Cards */}
              <div className="space-y-3">
                {expensesByDate.map((dateGroup) => {
                  const isExpanded = expandedDates.includes(dateGroup.date);

                  // Toggle handler for this specific date - Multi-expand mode
                  const handleToggle = () => {
                    setExpandedDates(
                      (prev) =>
                        prev.includes(dateGroup.date)
                          ? prev.filter((d) => d !== dateGroup.date) // Remove if already expanded
                          : [...prev, dateGroup.date], // Add if not expanded
                    );
                  };

                  return (
                    <div
                      key={dateGroup.date}
                      className="border border-gray-800 rounded-2xl overflow-hidden"
                    >
                      {/* Date Header Card */}
                      <button
                        type="button"
                        onClick={handleToggle}
                        className="w-full p-4 bg-black hover:bg-gray-900/80 transition-colors flex justify-between items-center"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center text-lg">
                            {isExpanded ? "📅" : "📆"}
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-white">
                              {formatDate(dateGroup.date)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {dateGroup.expenses.length} {t.recordsSuffix}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <div>
                            <div className="font-bold text-white text-sm">
                              ${dateGroup.total.toFixed(1)}
                            </div>
                          </div>
                          <ChevronDown
                            className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>
                      </button>

                      {/* Expanded Records */}
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-2 bg-black/30">
                          {dateGroup.expenses.map((e) => {
                            // Calculate beneficiaries display
                            const allParticipants =
                              e.participants.length === data.members.length;
                            const beneficiariesText = allParticipants
                              ? "全員"
                              : e.participants
                                  .map((p) => {
                                    const memberId =
                                      typeof p === "string" ? p : p.id;
                                    return data.members.find(
                                      (m) => m.id === memberId,
                                    )?.name;
                                  })
                                  .filter(Boolean)
                                  .join(", ");

                            return (
                              <div
                                key={e.id}
                                className="flex items-stretch bg-[#111] rounded-2xl border border-gray-800/70 overflow-hidden hover:border-gray-700 transition-colors animate-fade-in-up"
                              >
                                {/* Category color bar — wider */}
                                <div
                                  className="w-1.5 flex-shrink-0"
                                  style={{
                                    backgroundColor:
                                      CATEGORY_COLORS[e.category || "other"] ||
                                      "#6b7280",
                                  }}
                                />
                                <div className="flex justify-between items-center flex-1 p-3.5 min-w-0">
                                  <div className="flex-1 min-w-0 pr-3">
                                    <div className="font-bold text-sm flex items-center gap-1.5">
                                      <span className="text-base">
                                        {CATEGORIES.find(
                                          (c) => c.id === e.category,
                                        )?.icon || "📝"}
                                      </span>
                                      <span>
                                        {t[e.category as keyof typeof t] ||
                                          e.title}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-1 flex-wrap">
                                      <span className="text-gray-400 font-medium">
                                        {
                                          data.members.find(
                                            (m) => m.id === e.payerId,
                                          )?.name
                                        }
                                      </span>
                                      <span className="text-gray-700">•</span>
                                      <span>{beneficiariesText}</span>
                                      {e.originalCurrency &&
                                        e.originalCurrency !== "HKD" &&
                                        e.originalAmount && (
                                          <span className="text-gray-600">
                                            ({e.originalCurrency}{" "}
                                            {e.originalAmount.toFixed(0)})
                                          </span>
                                        )}
                                    </div>
                                    {e.note && (
                                      <div className="text-xs text-gray-600 mt-1 italic">
                                        {e.note}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right flex items-center gap-1 flex-shrink-0">
                                    <div className="font-bold text-sm">
                                      ${e.amountHKD.toFixed(1)}
                                    </div>
                                    <button
                                      onClick={() => handleEdit(e)}
                                      className="text-lg p-1.5 hover:bg-blue-500/20 rounded-lg transition-colors"
                                      title="編輯"
                                    >
                                      ✏️
                                    </button>
                                    {/* #7: Direct delete button */}
                                    <button
                                      onClick={() => handleDelete(e.id)}
                                      className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors text-gray-600 hover:text-red-400"
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
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          載入中...
        </div>
      }
    >
      <ExpensesPageContent />
    </Suspense>
  );
}
