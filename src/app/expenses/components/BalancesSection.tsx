import { ChevronDown } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { getAvatarColor, getAvatarText } from "../constants";
import type { ExpenseItem, Member } from "../types";

interface BalancesSectionProps {
  expenses: ExpenseItem[];
  members: Member[];
  balances: Record<string, number>;
  expanded: boolean;
  onToggle: () => void;
}

// 結餘狀況：每位成員嘅淨結餘 + 墊支/消費比例條
export function BalancesSection({ expenses, members, balances, expanded, onToggle }: BalancesSectionProps) {
  const { t } = useTranslation();

  const panelId = "balances-section-panel";

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-midnight-platform">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center justify-between p-4 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route-cyan focus-visible:ring-inset"
      >
        <h3 className="font-bold text-cloud-white">{t.balances}</h3>
        <ChevronDown
          className={`w-5 h-5 text-mist-blue transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div id={panelId} className="px-4 pb-4 space-y-2">
          {Object.entries(balances).map(([id, bal]) => {
            const member = members.find((m) => m.id === id);
            if (!member) return null;
            const memberIdx = members.findIndex(m => m.id === id);

            // Calculate 總墊支 (Total Paid)
            const totalPaid = expenses
              .filter(e => e.payerId === id)
              .reduce((sum, e) => sum + e.amountHKD, 0);

            // Calculate 總消費 (Total Consumed)
            const totalConsumed = expenses
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
              <div key={id} className="rounded-xl border border-white/5 bg-elevated-ink p-3">
                <div className="flex items-center gap-3 mb-2">
                  {/* Avatar */}
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-cloud-white"
                    style={{ backgroundColor: getAvatarColor(memberIdx) }}
                  >
                    {getAvatarText(member.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="truncate font-medium text-cloud-white">{member.name}</span>
                      <span className={`font-mono text-sm font-bold ${bal > 0 ? "text-route-cyan" : bal < 0 ? "text-route-magenta" : "text-mist-blue"}`}>
                        {bal > 0 ? `應收 +$${bal.toFixed(1)}` : bal < 0 ? `要付 -$${Math.abs(bal).toFixed(1)}` : "已平數 $0"}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Visual bars */}
                <div className="space-y-1 pl-12">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-xs text-mist-blue">{t.totalAdvanced?.slice(0,1) || '墊'}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-route-cyan/70 transition-all duration-500" style={{ width: `${(totalPaid / maxAmount) * 100}%` }} />
                    </div>
                    <span className="w-12 text-right font-mono text-xs text-mist-blue">${totalPaid.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-xs text-mist-blue">{t.totalSpent?.slice(0,1) || '花'}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-route-magenta/70 transition-all duration-500" style={{ width: `${(totalConsumed / maxAmount) * 100}%` }} />
                    </div>
                    <span className="w-12 text-right font-mono text-xs text-mist-blue">${totalConsumed.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
