import type { Dispatch, SetStateAction } from "react";
import { ChevronDown, ArrowRight, Check } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { getAvatarColor, getAvatarText } from "../constants";
import type { Member } from "../types";

export type Settlement = { from: string; to: string; fromId: string; toId: string; amount: number };

interface SettlementSectionProps {
  settlements: Settlement[];
  members: Member[];
  tripCode: string;
  paidSettlements: Set<string>;
  setPaidSettlements: Dispatch<SetStateAction<Set<string>>>;
  expanded: boolean;
  onToggle: () => void;
}

// 建議還款方案：最少交易結算 + 標記已付清
export function SettlementSection({
  settlements,
  members,
  tripCode,
  paidSettlements,
  setPaidSettlements,
  expanded,
  onToggle,
}: SettlementSectionProps) {
  const { t } = useTranslation();

  const panelId = "settlement-section-panel";

  const paidCount = settlements.filter((s) =>
    paidSettlements.has(`${s.from}→${s.to}@${s.amount.toFixed(1)}`)
  ).length;
  const totalCount = settlements.length;
  const statusText =
    totalCount === 0
      ? '全部已平數'
      : paidCount === totalCount
        ? '全部已平數'
        : paidCount === 0
          ? `待過數 ${totalCount} 次`
          : `已付 ${paidCount}/${totalCount}`;

  return (
    <div className="bg-[#1c1c1e] rounded-3xl border border-gray-800 overflow-hidden mb-4">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="w-full min-h-11 p-4 flex justify-between items-center hover:bg-gray-800/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-300">{t.settlements}</h3>
          {statusText && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                paidCount === totalCount
                  ? 'bg-green-500/15 text-green-300'
                  : 'bg-yellow-500/15 text-yellow-300'
              }`}
            >
              {statusText}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div id={panelId} className="px-4 pb-4">
          {settlements.length === 0 ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">🎉</div>
              <div className="text-gray-400 text-sm">{t.emptySettlements}</div>
            </div>
          ) : (
            <div className="space-y-2">
              {settlements.map((s, idx) => {
                // 用 id 配對（修正：之前靠同名配對，兩個同名成員會顯示錯誤頭像）
                const fromIdx = Math.max(0, members.findIndex(m => m.id === s.fromId));
                const toIdx = Math.max(0, members.findIndex(m => m.id === s.toId));
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
                          `tripUtility_paidSettlements_${tripCode}`,
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
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ring-2 ring-red-500/40"
                      style={{ backgroundColor: getAvatarColor(fromIdx) }}
                    >
                      {getAvatarText(s.from)}
                    </div>
                    <span className={`text-sm font-medium text-red-300 truncate flex-1 min-w-0 ${isPaid ? 'line-through' : ''}`}>{s.from}</span>
                    <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0" aria-hidden="true" />
                    <span className={`text-sm font-medium text-green-300 truncate flex-1 min-w-0 text-right ${isPaid ? 'line-through' : ''}`}>{s.to}</span>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ring-2 ring-green-500/40"
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
                      className={`min-w-11 min-h-11 px-3 inline-flex items-center justify-center gap-1 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
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
  );
}
