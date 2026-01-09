"use client";

import { useEffect, useState, useCallback } from "react";
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

export default function ExpensesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const [data, setData] = useState<TripData>(null);
  const [loading, setLoading] = useState(false);
  const [tripName, setTripName] = useState("");
  const [setupNames, setSetupNames] = useState<string[]>(["", ""]);

  // Input State
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [payerId, setPayerId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [category, setCategory] = useState("dining");
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // UI State
  const [showBalances, setShowBalances] = useState(false);
  const [showSettlements, setShowSettlements] = useState(false);
  const [showRecords, setShowRecords] = useState(true);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadTrip = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    try {
      const result = await getTripByCode(code);
      if (result) {
        setData(result);
        setParticipantIds(prev =>
          prev.length === 0 ? result.members.map(m => m.id) : prev
        );
        setPayerId(prev =>
          !prev && result.members.length > 0 ? result.members[0].id : prev
        );
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [code]);

  useEffect(() => { loadTrip(); }, [loadTrip]);

  useEffect(() => {
    if (data?.code) {
      localStorage.setItem('last_trip_code', data.code);
    }
  }, [data?.code]);

  useEffect(() => {
    if (!code) {
      const lastCode = localStorage.getItem('last_trip_code');
      if (lastCode) {
        router.replace(`/expenses?code=${lastCode}`);
      }
    }
  }, [code, router]);

  const handleCreateTrip = async () => {
    const validNames = setupNames.filter(n => n.trim() !== "");
    if (!tripName) { showToast("請輸入旅程名稱", "error"); return; }
    if (validNames.length < 2) { showToast("最少 2 人", "error"); return; }

    setLoading(true);
    try {
      const newTrip = await createTrip(tripName, validNames);
      showToast("建立成功！正在進入...", "success");
      setTimeout(() => {
        router.push(`/expenses?code=${newTrip.code}`);
      }, 500);
    } catch (e) {
      console.error(e);
      showToast("建立失敗，請檢查網絡", "error");
      setLoading(false);
    }
  };

  const handleAddExpense = async () => {
    if (!data || !amount || !payerId || participantIds.length === 0) {
      showToast("資料不完整", "error");
      return;
    }
    try {
      await addExpense({
        code: data.code,
        title: CATEGORIES.find(c => c.id === category)?.label || "其他",
        category,
        note,
        date,
        payerId,
        participantIds,
        amountHKD: Number(amount),
      });
      showToast("✅ 已新增");
      setAmount("");
      setNote("");
      loadTrip();
    } catch (e) {
      showToast("新增失敗", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("刪除?")) return;
    if (!data) return;
    try {
      await deleteExpense(data.code, id);
      showToast("已刪除");
      loadTrip();
    } catch (e) {
      console.error(e);
      showToast("刪除失敗", "error");
    }
  };

  // Calculations
  const calculateBalances = () => {
    if (!data) return {};
    const bal: { [key: string]: number } = {};
    data.members.forEach(m => bal[m.id] = 0);
    data.expenses.forEach(e => {
      const share = e.amountHKD / e.participants.length;
      bal[e.payerId] += e.amountHKD;
      e.participants.forEach(pId => {
        if (bal[pId] !== undefined) bal[pId] -= share;
      });
    });
    return bal;
  };
  
  const balances = calculateBalances();
  const totalExpenses = data?.expenses.reduce((sum, e) => sum + e.amountHKD, 0) || 0;

  if (!code) {
    return (
      <div className="min-h-screen bg-black p-4 text-white">
        <h1 className="text-3xl font-bold mb-6">建立新旅程</h1>
        <input className="w-full p-4 bg-[#1c1c1e] rounded-xl mb-4 border border-gray-800" placeholder="旅程名稱" value={tripName} onChange={e => setTripName(e.target.value)} />
        {setupNames.map((n, i) => (
          <input key={i} className="w-full p-4 bg-[#1c1c1e] rounded-xl mb-2 border border-gray-800" placeholder={`成員 ${i+1}`} value={n} onChange={e => {
            const newNames = [...setupNames]; newNames[i] = e.target.value; setSetupNames(newNames);
          }} />
        ))}
        <div className="flex gap-2 mt-4">
          <button onClick={() => setSetupNames([...setupNames, ""])} className="flex-1 py-3 bg-[#1c1c1e] rounded-xl">加人</button>
          <button onClick={handleCreateTrip} disabled={loading} className="flex-1 py-3 bg-blue-600 rounded-xl">{loading ? "..." : "開始"}</button>
        </div>
      </div>
    );
  }

  if (code && (loading || !data)) {
    return (
      <div className="min-h-screen bg-black p-4 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-2">載入中...</div>
          <div className="text-sm text-gray-400">正在取得旅程資料</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 pb-24 text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{data.name}</h1>
        <button onClick={() => router.push('/expenses')} className="text-xs bg-[#1c1c1e] px-3 py-2 rounded-xl">新旅程</button>
      </div>
      <div className="mb-6 p-6 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700">
        <div className="text-blue-100 text-sm">總開支</div>
        <div className="text-4xl font-bold">HKD {totalExpenses.toFixed(2)}</div>
        <div className="text-blue-100 text-xs mt-2">代碼: {data.code}</div>
      </div>
      
      <div className="bg-[#1c1c1e] p-4 rounded-3xl border border-gray-800 mb-6 space-y-3">
        <div className="grid grid-cols-3 gap-2">
           {CATEGORIES.map(c => <button key={c.id} onClick={() => setCategory(c.id)} className={`p-2 text-sm rounded-xl border ${category===c.id?"bg-blue-600 border-blue-600":"border-gray-700"}`}>{c.icon} {c.label}</button>)}
        </div>
        <div className="flex gap-2">
           <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-1/3 p-3 bg-black rounded-xl border border-gray-800"/>
           <input placeholder="備註" value={note} onChange={e=>setNote(e.target.value)} className="flex-1 p-3 bg-black rounded-xl border border-gray-800"/>
        </div>
        <div>
           <input type="number" placeholder="金額 (HKD)" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full p-3 bg-black rounded-xl border border-gray-800"/>
        </div>
        <div className="text-xs text-gray-400">誰付款:</div>
        <div className="flex gap-2 flex-wrap">{data.members.map(m=><button key={m.id} onClick={()=>setPayerId(m.id)} className={`px-3 py-1 rounded-full text-xs border ${payerId===m.id?"bg-blue-600 border-blue-600":"border-gray-700"}`}>{m.name}</button>)}</div>
        <div className="text-xs text-gray-400">誰分擔:</div>
        <div className="flex gap-2 flex-wrap">{data.members.map(m=><button key={m.id} onClick={()=>setParticipantIds(p=>p.includes(m.id)?p.filter(x=>x!==m.id):[...p,m.id])} className={`px-3 py-1 rounded-full text-xs border ${participantIds.includes(m.id)?"bg-blue-600 border-blue-600":"border-gray-700"}`}>{m.name}</button>)}</div>
        <button onClick={handleAddExpense} className="w-full py-3 bg-blue-600 rounded-xl font-bold">新增</button>
      </div>

      <div className="space-y-2">
        <h3 className="font-bold">結餘</h3>
        {Object.entries(balances).map(([id, bal]) => (
          <div key={id} className="flex justify-between text-sm p-3 bg-[#1c1c1e] rounded-xl">
             <span>{data.members.find(m=>m.id===id)?.name}</span>
             <span className={bal>0?"text-green-400":bal<0?"text-red-400":"text-gray-500"}>{bal>0?`收 $${bal.toFixed(1)}`:bal<0?`付 $${(-bal).toFixed(1)}`:"-"}</span>
          </div>
        ))}
      </div>
      
      <div className="mt-6 space-y-2">
         <h3 className="font-bold">記錄</h3>
         {data.expenses.map(e => (
           <div key={e.id} className="flex justify-between p-3 bg-[#1c1c1e] rounded-xl items-center">
             <div><div className="font-bold">{e.title}</div><div className="text-xs text-gray-400">{e.payerName} 付</div></div>
             <div className="text-right"><div>${e.amountHKD.toFixed(1)}</div><button onClick={()=>handleDelete(e.id)} className="text-xs text-red-500">刪</button></div>
           </div>
         ))}
      </div>
      {toast && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 px-4 py-2 bg-gray-800 text-white rounded-xl">{toast.msg}</div>}
    </div>
  );
}
