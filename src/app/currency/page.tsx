"use client";

import { useState } from "react";
import { Settings2, ArrowDown } from "lucide-react";

type Op = "+" | "-" | "×" | "÷" | null;

export default function CurrencyPage() {
  const [display, setDisplay] = useState<string>("0");
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Op>(null);
  const [waitingNext, setWaitingNext] = useState<boolean>(false);
  const [history, setHistory] = useState<string>("");
  const [rateToHKD, setRateToHKD] = useState<string>("0.053");
  const [isEditingRate, setIsEditingRate] = useState(false);

  const calculateHKD = (): number | null => {
    const value = parseFloat(display);
    const rate = parseFloat(rateToHKD);
    if (Number.isNaN(value) || Number.isNaN(rate)) return null;
    return value * rate;
  };
  const hkd = calculateHKD();

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    }).format(num);
  };

  const formatDisplay = (numStr: string): string => {
    const num = parseFloat(numStr);
    if (Number.isNaN(num)) return "0";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const inputDigit = (d: string) => {
    if (history.includes("=")) {
      setHistory("");
      setPrevValue(null);
      setOperator(null);
      setDisplay(d);
      setWaitingNext(false);
      return;
    }
    if (waitingNext) {
      setDisplay(d);
      setWaitingNext(false);
    } else {
      if (display.length > 9) return;
      setDisplay(display === "0" ? d : display + d);
    }
  };

  const inputDot = () => {
    if (history.includes("=")) {
      setHistory("");
      setPrevValue(null);
      setOperator(null);
      setDisplay("0.");
      setWaitingNext(false);
      return;
    }
    if (waitingNext) {
      setDisplay("0.");
      setWaitingNext(false);
      return;
    }
    if (!display.includes(".")) setDisplay(display + ".");
  };

  const clearAll = () => {
    setDisplay("0");
    setPrevValue(null);
    setOperator(null);
    setWaitingNext(false);
    setHistory("");
  };

  const toggleSign = () => {
    setDisplay(String(parseFloat(display) * -1));
  };

  const percent = () => {
    const val = parseFloat(display);
    setDisplay(String(val / 100));
  };

  const backspace = () => {
    if (history.includes("=")) {
      clearAll();
      return;
    }
    if (waitingNext) {
      setDisplay("0");
      setWaitingNext(false);
      return;
    }
    if (display.length <= 1) {
      setDisplay("0");
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const compute = (a: number, b: number, op: Op) => {
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? 0 : a / b;
      default: return b;
    }
  };

  const setOp = (op: Op) => {
    const current = parseFloat(display);
    if (history.includes("=")) {
      setPrevValue(current);
      setOperator(op);
      setWaitingNext(true);
      setHistory(`${formatDisplay(String(current))} ${op}`);
      return;
    }
    if (prevValue !== null && operator && !waitingNext) {
      const result = compute(prevValue, current, operator);
      setPrevValue(result);
      setDisplay(String(result));
      setHistory(`${formatDisplay(String(result))} ${op}`);
    } else {
      setPrevValue(current);
      setHistory(`${formatDisplay(String(current))} ${op}`);
    }
    setOperator(op);
    setWaitingNext(true);
  };

  const equals = () => {
    if (operator === null || prevValue === null) return;
    const current = parseFloat(display);
    const result = compute(prevValue, current, operator);
    setHistory(`${formatDisplay(String(prevValue))} ${operator} ${formatDisplay(String(current))} =`);
    setDisplay(String(result));
    setPrevValue(null);
    setOperator(null);
    setWaitingNext(true);
  };

  const CalcButton = ({
    label,
    onClick,
    type = "number",
    active = false
  }: {
    label: string;
    onClick: () => void;
    type?: "number" | "operator" | "action" | "featured";
    active?: boolean;
  }) => {
    let bgClass = "bg-[#333333] text-white";
    if (type === "action") bgClass = "bg-[#a5a5a5] text-black";
    if (type === "featured") bgClass = "bg-[#ff9f0a] text-white";
    if (type === "operator") {
      bgClass = active
        ? "bg-white text-[#ff9f0a] transition-all duration-200"
        : "bg-[#ff9f0a] text-white transition-all duration-200";
    }

    return (
      <button
        onClick={onClick}
        className={`aspect-square rounded-full text-3xl font-light flex items-center justify-center active:brightness-125 transition-all ${bgClass}`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="h-screen bg-black flex flex-col px-4 overflow-hidden">

      {/* Header */}
      <div className="w-full flex justify-between items-center pt-3 mb-4 shrink-0 z-20 relative">
        <h1 className="text-xl font-bold text-white tracking-wide">匯率</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditingRate(!isEditingRate)}
            className={`p-2 rounded-full transition-colors active:scale-95 ${isEditingRate ? 'bg-[#ff9f0a] text-white' : 'bg-[#1c1c1e] text-white/60'}`}
          >
            <Settings2 size={20} />
          </button>
          <div className="flex items-center gap-2 bg-[#1c1c1e] px-3 py-1.5 rounded-full border border-white/10">
            <span className="text-xs font-medium text-white">🇯🇵 JPY</span>
            <ArrowDown size={12} className="-rotate-90 text-white/40" />
            <span className="text-xs font-medium text-white">🇭🇰 HKD</span>
          </div>
        </div>
      </div>

      {/* Editing Modal */}
      {isEditingRate && (
        <div className="absolute top-16 left-4 right-4 z-30 bg-[#1c1c1e] p-4 rounded-2xl border border-white/10 shadow-2xl">
          <label className="text-xs text-white/40 mb-2 block uppercase tracking-wider font-medium">自訂匯率 (1 JPY = ? HKD)</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.001"
              value={rateToHKD}
              onChange={(e) => setRateToHKD(e.target.value)}
              className="flex-1 bg-black text-white text-xl px-4 py-3 rounded-xl border border-white/10 focus:border-[#ff9f0a] focus:outline-none placeholder-white/20 tabular-nums"
              placeholder="0.053"
            />
            <button
              onClick={() => setIsEditingRate(false)}
              className="bg-white text-black px-5 py-2 rounded-xl font-bold text-sm active:opacity-80"
            >
              完成
            </button>
          </div>
        </div>
      )}

      {/* Display Screen */}
      <div className="flex flex-col justify-end space-y-2.5 mb-3 pr-2 relative z-10">

        {/* Part 1 - JPY (輸入) 在上 */}
        <div className="text-right">
          <div className="flex justify-end items-center gap-2 mb-1 h-5">
            <span className="text-white/60 text-base font-medium tracking-wide">
              {history}
            </span>
            {!history && <span className="text-white/30 text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/5">JPY Input</span>}
          </div>
          <div className="text-[56px] font-light text-white tracking-tight tabular-nums leading-none break-all">
            {formatDisplay(display)}
          </div>
        </div>

        {/* Part 2 - HKD (結果) 在下 */}
        <div className="text-right">
          <div className="flex justify-end items-center gap-2 mb-1">
            <span className="text-[#ff9f0a] text-[10px] font-bold bg-[#ff9f0a]/10 px-1.5 py-0.5 rounded">HKD</span>
          </div>
          <div className="text-[46px] font-semibold text-[#ff9f0a] tracking-tight tabular-nums leading-none break-all">
            ${hkd !== null ? formatDisplay(String(hkd)) : "0"}
          </div>
          <div className="text-[10px] text-white/40 font-mono mt-1.5">
            Rate: {rateToHKD}
          </div>
        </div>

      </div>

      {/* Keypad */}
      <div className="grid grid-cols-4 gap-3 w-full max-w-[400px] mx-auto shrink-0 mb-4 pb-2">
        <CalcButton label="⌫" type="action" onClick={backspace} />
        <CalcButton label="AC" type="action" onClick={clearAll} />
        <CalcButton label="%" type="action" onClick={percent} />
        <CalcButton label="÷" type="operator" onClick={() => setOp("÷")} active={operator === "÷"} />

        <CalcButton label="7" onClick={() => inputDigit("7")} />
        <CalcButton label="8" onClick={() => inputDigit("8")} />
        <CalcButton label="9" onClick={() => inputDigit("9")} />
        <CalcButton label="×" type="operator" onClick={() => setOp("×")} active={operator === "×"} />

        <CalcButton label="4" onClick={() => inputDigit("4")} />
        <CalcButton label="5" onClick={() => inputDigit("5")} />
        <CalcButton label="6" onClick={() => inputDigit("6")} />
        <CalcButton label="-" type="operator" onClick={() => setOp("-")} active={operator === "-"} />

        <CalcButton label="1" onClick={() => inputDigit("1")} />
        <CalcButton label="2" onClick={() => inputDigit("2")} />
        <CalcButton label="3" onClick={() => inputDigit("3")} />
        <CalcButton label="+" type="operator" onClick={() => setOp("+")} active={operator === "+"} />

        <button
          onClick={() => inputDigit("0")}
          className="col-span-2 rounded-full bg-[#333333] text-white text-3xl font-light text-left pl-9 active:brightness-125 transition-all aspect-[2.25/1] flex items-center"
        >
          0
        </button>
        <CalcButton label="." onClick={inputDot} />
        <CalcButton label="=" type="featured" onClick={equals} />
      </div>
    </div>
  );
}