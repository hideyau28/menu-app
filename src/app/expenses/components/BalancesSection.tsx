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
    <div className="bg-[#1c1c1e] rounded-3xl border border-gray-800 overflow-hidden mb-4">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="w-full p-4 flex justify-between items-center hover:bg-gray-800/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
      >
        <h3 className="font-bold text-gray-300">{t.balances}</h3>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
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
                        {bal > 0 ? `應收 +$${bal.toFixed(1)}` : bal < 0 ? `要付 -$${Math.abs(bal).toFixed(1)}` : "已平數 $0"}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Visual bars */}
                <div className="space-y-1 pl-12">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-6">{t.totalAdvanced?.slice(0,1) || '墊'}</span>
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500/60 rounded-full transition-all duration-500" style={{ width: `${(totalPaid / maxAmount) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">${totalPaid.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-6">{t.totalSpent?.slice(0,1) || '花'}</span>
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500/60 rounded-full transition-all duration-500" style={{ width: `${(totalConsumed / maxAmount) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">${totalConsumed.toFixed(1)}</span>
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
