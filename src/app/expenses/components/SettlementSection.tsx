import type { Dispatch, SetStateAction } from "react";
import { ChevronDown, ArrowRight, Check, ArrowLeftRight } from "lucide-react";
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
    <div className="mb-4 overflow-hidden rounded-2xl border border-route-magenta/25 bg-midnight-platform">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full min-h-11 items-center justify-between p-4 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route-magenta focus-visible:ring-inset"
      >
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-route-magenta" aria-hidden="true" />
          <h3 className="font-bold text-cloud-white">{t.settlements}</h3>
          {statusText && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                paidCount === totalCount
                  ? 'bg-route-cyan/15 text-route-cyan'
                  : 'bg-signal-amber/15 text-signal-amber'
              }`}
            >
              {statusText}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-mist-blue transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div id={panelId} className="px-4 pb-4">
          {settlements.length === 0 ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">🎉</div>
              <div className="text-sm text-mist-blue">{t.emptySettlements}</div>
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
                  className={`space-y-2 rounded-xl border border-white/5 bg-elevated-ink p-3 transition-opacity ${isPaid ? 'opacity-50' : ''}`}
                  aria-label={`${s.from} 還 $${s.amount.toFixed(1)} 俾 ${s.to}${isPaid ? '（已付清）' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-cloud-white ring-2 ring-route-magenta/50"
                      style={{ backgroundColor: getAvatarColor(fromIdx) }}
                    >
                      {getAvatarText(s.from)}
                    </div>
                    <span className={`min-w-0 flex-1 truncate text-sm font-medium text-route-magenta ${isPaid ? 'line-through' : ''}`}>{s.from}</span>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-route-magenta" aria-hidden="true" />
                    <span className={`min-w-0 flex-1 truncate text-right text-sm font-medium text-route-cyan ${isPaid ? 'line-through' : ''}`}>{s.to}</span>
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-cloud-white ring-2 ring-route-cyan/50"
                      style={{ backgroundColor: getAvatarColor(toIdx) }}
                    >
                      {getAvatarText(s.to)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className={`flex-1 text-center font-mono text-base font-bold tracking-tight ${isPaid ? 'text-mist-blue line-through' : 'text-route-magenta'}`}>
                      HKD ${s.amount.toFixed(1)}
                    </div>
                    <button
                      onClick={togglePaid}
                      aria-pressed={isPaid}
                      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route-cyan ${
                        isPaid
                          ? 'bg-route-cyan/20 text-route-cyan'
                          : 'bg-white/5 text-mist-blue hover:bg-white/10'
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
