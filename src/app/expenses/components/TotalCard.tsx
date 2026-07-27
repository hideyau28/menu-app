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
    <div className="relative mb-6 overflow-hidden rounded-tl-3xl rounded-br-3xl rounded-tr-lg rounded-bl-lg border border-white/10 bg-midnight-platform p-6">
      {/* 頂部 cyan 航線髮絲線（安靜，唔係整塊發光） */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-route-cyan/60 via-route-cyan/20 to-transparent" />
      <div className="relative">
        <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.2em] text-mist-blue">{t.totalExpense}</div>
        <div className="font-mono text-4xl font-extrabold tracking-tight text-cloud-white">
            <span className="mr-1 text-2xl text-route-cyan">HKD</span>
            {expenses.reduce((s, e) => s + e.amountHKD, 0).toLocaleString('en', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
        </div>
        {/* Per-person average + record count, or empty hint */}
        {members.length > 0 && expenses.length > 0 ? (
          <div className="mt-2 flex items-center gap-2 text-sm text-mist-blue">
            <span>人均 ${(expenses.reduce((s, e) => s + e.amountHKD, 0) / members.length).toFixed(1)}</span>
            <span className="text-mist-blue/40">·</span>
            <span>{expenses.length} 筆記錄</span>
          </div>
        ) : (
          <div className="mt-2 text-sm text-mist-blue">
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
                          ? 'bg-route-cyan/15 text-cloud-white'
                          : categoryFilter
                            ? 'text-mist-blue/60 hover:text-mist-blue'
                            : 'text-mist-blue hover:bg-white/5'
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat.id] }} />
                      <span>{cat.icon} {cat.label}</span>
                      <span className={isActive ? 'text-cloud-white/80' : 'text-mist-blue/70'}>{((cat.amount / total) * 100).toFixed(0)}%</span>
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
