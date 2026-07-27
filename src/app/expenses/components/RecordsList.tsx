import type { Dispatch, SetStateAction } from "react";
import { ChevronDown, Calendar, Trash2 } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { CATEGORIES, CATEGORY_COLORS } from "../constants";
import type { ExpenseItem, Member } from "../types";

export type DateGroup = { date: string; expenses: ExpenseItem[]; total: number };

interface RecordsListProps {
  dateGroups: DateGroup[];
  members: Member[];
  categoryFilter: string | null;
  setCategoryFilter: Dispatch<SetStateAction<string | null>>;
  expandedDates: string[];
  setExpandedDates: Dispatch<SetStateAction<string[]>>;
  onEdit: (expense: ExpenseItem) => void;
  onDelete: (id: string) => void;
  formatDate: (date: string) => string;
  expanded: boolean;
  onToggle: () => void;
}

// 記錄列表：按日期分組 + 類別篩選
export function RecordsList({
  dateGroups,
  members,
  categoryFilter,
  setCategoryFilter,
  expandedDates,
  setExpandedDates,
  onEdit,
  onDelete,
  formatDate,
  expanded,
  onToggle,
}: RecordsListProps) {
  const { t } = useTranslation();

  const panelId = "records-list-panel";

  return (
    <div className="bg-[#1c1c1e] rounded-3xl border border-gray-800 overflow-hidden mb-4">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="w-full p-4 flex justify-between items-center hover:bg-gray-800/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
      >
        <h3 className="font-bold text-gray-300">{t.recordList}</h3>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div id={panelId} className="px-4 pb-4">
          {/* Active category filter indicator */}
          {categoryFilter && (() => {
            const cat = CATEGORIES.find(c => c.id === categoryFilter);
            return cat ? (
              <div className="mb-3 inline-flex items-center gap-2 bg-white/10 rounded-full pl-3 pr-1 py-1 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat.id] }} />
                <span>只睇「{cat.icon} {cat.label}」</span>
                <button
                  onClick={() => setCategoryFilter(null)}
                  className="min-w-11 min-h-11 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label="清除類別篩選"
                >
                  ✕
                </button>
              </div>
            ) : null;
          })()}
          {dateGroups.length === 0 && (
            <div className="text-center py-10">
              <div className="text-5xl mb-3">📭</div>
              <div className="text-gray-400 mb-1">{categoryFilter ? t.emptyFiltered : t.emptyRecords}</div>
              <div className="text-xs text-gray-500">{categoryFilter ? t.emptyFilteredHint : t.emptyRecordsHint}</div>
            </div>
          )}

          {/* Date Cards */}
          <div className="space-y-3">
            {dateGroups.map((dateGroup) => {
              const isExpanded = expandedDates.includes(dateGroup.date);
              const datePanelId = `records-date-panel-${dateGroup.date.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

              // Toggle handler for this specific date - Multi-expand mode
              const handleToggle = () => {
                setExpandedDates(prev =>
                  prev.includes(dateGroup.date)
                    ? prev.filter(d => d !== dateGroup.date)  // Remove if already expanded
                    : [...prev, dateGroup.date]               // Add if not expanded
                );
              };

            return (
              <div key={dateGroup.date} className="border border-gray-800 rounded-2xl overflow-hidden">
                {/* Date Header Card */}
                <button
                  type="button"
                  onClick={handleToggle}
                  aria-expanded={isExpanded}
                  aria-controls={datePanelId}
                  className="w-full p-4 bg-black hover:bg-gray-900/80 transition-colors flex justify-between items-center"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center text-blue-300">
                      <Calendar className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-white">{formatDate(dateGroup.date)}</div>
                      <div className="mt-0.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-800 text-xs text-gray-300 font-medium">
                          {dateGroup.expenses.length} {t.recordsSuffix}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <div className="font-bold text-white text-sm">
                        <span className="text-gray-500 text-xs font-normal mr-1">HKD</span>
                        ${dateGroup.total.toFixed(1)}
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {/* Expanded Records */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-2 bg-black/30">
                    {dateGroup.expenses.map((e) => {
                      // Calculate beneficiaries display
                      const allParticipants = e.participants.length === members.length;
                      const beneficiariesText = allParticipants
                        ? "全員"
                        : e.participants.map(p => {
                            const memberId = typeof p === 'string' ? p : p.id;
                            return members.find(m => m.id === memberId)?.name;
                          }).filter(Boolean).join(", ");

                      return (
                        <div key={e.id} className="flex items-stretch bg-[#1c1c1e] rounded-xl border border-gray-800 overflow-hidden">
                          {/* Category color indicator */}
                          <div className="w-1 flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[e.category || 'other'] || '#6b7280' }} />
                          <div className="flex justify-between items-center flex-1 p-3 min-w-0">
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="font-bold text-sm">
                              {CATEGORIES.find(c => c.id === e.category)?.icon || "📝"} {(() => { const v = t[e.category as keyof typeof t]; return typeof v === 'string' ? v : e.title; })()}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {members.find(m => m.id === e.payerId)?.name} {t.paidSuffix} • {beneficiariesText}
                              {e.originalCurrency && e.originalCurrency !== 'HKD' && e.originalAmount && (
                                <span className="ml-1 text-gray-400">({t.origPrefix} {e.originalCurrency} {e.originalAmount.toFixed(0)})</span>
                              )}
                            </div>
                            {e.note && (
                              <div className="text-xs text-gray-500 mt-1">
                                <span className="opacity-70">📝</span> {e.note}
                              </div>
                            )}
                          </div>
                          <div className="text-right flex items-center gap-0.5 flex-shrink-0">
                            <div className="font-bold text-sm mr-1">${e.amountHKD.toFixed(1)}</div>
                            <button
                              onClick={() => onEdit(e)}
                              className="min-w-11 min-h-11 flex items-center justify-center text-lg hover:bg-blue-500/20 rounded-lg transition-colors"
                              aria-label="編輯記錄"
                              title="編輯"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => onDelete(e.id)}
                              className="min-w-11 min-h-11 flex items-center justify-center hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                              aria-label="刪除記錄"
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
  );
}
