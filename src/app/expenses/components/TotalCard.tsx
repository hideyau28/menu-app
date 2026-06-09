import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { CATEGORIES, CATEGORY_COLORS } from "../constants";
import type { ExpenseItem, Member } from "../types";

interface TotalCardProps {
  expenses: ExpenseItem[];
  members: Member[];
  categoryFilter: string | null;
  setCategoryFilter: Dispatch<SetStateAction<string | null>>;
}

// 總開支卡 + 人均 + 類別比例條（可點擊篩選）
export function TotalCard({ expenses, members, categoryFilter, setCategoryFilter }: TotalCardProps) {
  const { t } = useTranslation();

  return (
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
            {expenses.reduce((s, e) => s + e.amountHKD, 0).toLocaleString('en', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
        </div>
        {/* Per-person average + record count, or empty hint */}
        {members.length > 0 && expenses.length > 0 ? (
          <div className="flex items-center gap-2 mt-2 text-sm text-blue-100/90">
            <span>人均 ${(expenses.reduce((s, e) => s + e.amountHKD, 0) / members.length).toFixed(1)}</span>
            <span className="text-blue-200/40">·</span>
            <span>{expenses.length} 筆記錄</span>
          </div>
        ) : (
          <div className="mt-2 text-sm text-blue-100/80">
            ↓ 喺下面記低第一筆支出
          </div>
        )}

        {/* Rainbow Proportion Bar + Category Legend */}
        {expenses.length > 0 && (() => {
          const total = expenses.reduce((s, e) => s + e.amountHKD, 0);
          if (total === 0) return null;

          const categoryTotals = CATEGORIES.map(cat => ({
            id: cat.id,
            label: cat.label,
            icon: cat.icon,
            amount: expenses
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
  );
}
