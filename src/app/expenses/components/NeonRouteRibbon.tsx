import { ArrowRight } from "lucide-react";
import { getAvatarColor, getAvatarText } from "../constants";
import type { Member } from "../types";

interface NeonRouteRibbonProps {
  members: Member[];
  /** 現時選中的付款人 id：夜行路線上「亮住」嘅站點，視覺上餵入 Quick Add */
  activeId: string;
  /** 結算分支標籤（由 caller 按語言傳入） */
  branchLabel: string;
  /** 航線小標題（由 caller 按語言傳入） */
  routeLabel: string;
}

// 霓虹航線帶（純顯示）：將真實成員化成夜行路線上的命名站點。
// 一條 cyan 主航線串起所有成員，尾端一段 magenta 分支代表結算方向。
// 2–8 位成員都保持可讀；橫向捲動而唔會令整頁溢出。
export function NeonRouteRibbon({ members, activeId, branchLabel, routeLabel }: NeonRouteRibbonProps) {
  if (members.length === 0) return null;

  return (
    <section aria-label={routeLabel} className="mb-4 lg:mb-6">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-mist-blue">{routeLabel}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-route-cyan/40 to-transparent" />
        <span className="font-mono text-[11px] text-mist-blue">{members.length}</span>
      </div>
      <div className="no-scrollbar -mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ol className="flex min-w-max items-start gap-0 pb-1">
          {members.map((m, idx) => {
            const isActive = m.id === activeId;
            const color = getAvatarColor(idx);
            return (
              <li key={m.id} className="flex items-start">
                {idx > 0 && (
                  <span
                    aria-hidden="true"
                    className="route-seg mt-6 h-[3px] w-8 rounded-full bg-route-cyan/70 shadow-[0_0_8px_rgba(94,235,255,0.5)] sm:w-10"
                    style={{ animationDelay: `${idx * 90}ms` }}
                  />
                )}
                <div
                  className="route-node flex w-16 flex-col items-center"
                  style={{ animationDelay: `${idx * 90 + 60}ms` }}
                >
                  <span
                    className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-bold text-cloud-white ${
                      isActive
                        ? "border-route-cyan shadow-[0_0_14px_rgba(94,235,255,0.7)]"
                        : "border-white/15"
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {getAvatarText(m.name)}
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-1 h-1.5 w-1.5 rounded-full bg-route-cyan shadow-[0_0_8px_rgba(94,235,255,0.9)]"
                      />
                    )}
                  </span>
                  <span
                    className={`mt-1.5 max-w-[64px] truncate text-center text-xs ${
                      isActive ? "font-semibold text-cloud-white" : "text-mist-blue"
                    }`}
                    title={m.name}
                  >
                    {m.name}
                  </span>
                </div>
              </li>
            );
          })}

          {/* Magenta 結算分支：夜行路線最終導向「邊個俾邊個」 */}
          <li className="flex items-start" aria-label={branchLabel}>
            <span
              aria-hidden="true"
              className="route-seg mt-6 h-[3px] w-8 rounded-full bg-route-magenta/80 shadow-[0_0_8px_rgba(255,61,154,0.55)] sm:w-10"
              style={{ animationDelay: `${members.length * 90}ms` }}
            />
            <div
              className="route-node flex w-16 flex-col items-center"
              style={{ animationDelay: `${members.length * 90 + 60}ms` }}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-route-magenta bg-route-magenta/10 text-route-magenta shadow-[0_0_12px_rgba(255,61,154,0.5)]">
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="mt-1.5 max-w-[64px] truncate text-center text-xs font-medium text-route-magenta">
                {branchLabel}
              </span>
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}
