import type { Dispatch, SetStateAction } from "react";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { getAvatarColor, getAvatarText, MEMBER_NAME_EXAMPLES } from "../constants";

type RecentTrip = { code: string; name: string; date: string };

interface CreateTripScreenProps {
  joinCode: string;
  setJoinCode: Dispatch<SetStateAction<string>>;
  onJoin: () => void;
  recentTrips: RecentTrip[];
  setRecentTrips: Dispatch<SetStateAction<RecentTrip[]>>;
  onOpenTrip: (code: string) => void;
  tripName: string;
  setTripName: Dispatch<SetStateAction<string>>;
  memberNames: string[];
  setMemberNames: Dispatch<SetStateAction<string[]>>;
  onCreate: () => void;
  submitting: boolean;
}

// 情況 C：未有 code 時顯示「加入旅程 / 最近旅程 / 建立新旅程」
export function CreateTripScreen({
  joinCode,
  setJoinCode,
  onJoin,
  recentTrips,
  setRecentTrips,
  onOpenTrip,
  tripName,
  setTripName,
  memberNames,
  setMemberNames,
  onCreate,
  submitting,
}: CreateTripScreenProps) {
  return (
    <div className="min-h-screen bg-black p-4 pt-8 text-white pb-20 relative overflow-hidden">
      {/* Background decorative orbs */}
      <div className="fixed top-20 -left-20 w-60 h-60 rounded-full opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
      />
      <div className="fixed bottom-20 -right-20 w-60 h-60 rounded-full opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }}
      />
      <Toaster position="bottom-center" theme="dark" richColors expand={false} />
      <div className="max-w-md md:max-w-4xl mx-auto relative">
        <div className="md:grid md:grid-cols-2 md:gap-10 md:items-start">
          {/* Left column: brand + onboarding teaching */}
          <div className="md:pt-6">
          {/* Header */}
          <div className="text-center md:text-left mb-6">
            <div className="text-5xl mb-2 md:mx-0 inline-block" style={{ filter: 'drop-shadow(0 0 20px rgba(59,130,246,0.3))' }}>✈️</div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">旅程記帳</h1>
            <p className="text-gray-400 text-sm mt-2">輕鬆分帳，旅途無憂</p>
          </div>

          {/* 首次使用者：三步玩法簡介（有最近旅程就唔再顯示，減少雜訊） */}
          {recentTrips.length === 0 && (
            <div className="bg-[#111827]/60 rounded-2xl p-4 mb-6 border border-blue-900/40">
              <div className="text-sm font-bold text-blue-200 mb-3">🚀 三步就開始</div>
              <ol className="space-y-2.5">
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600/30 text-blue-200 text-xs font-bold flex items-center justify-center flex-shrink-0" aria-hidden="true">1</span>
                  <span className="text-sm text-gray-300">下面寫低旅程名，撳「開始旅程」</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600/30 text-blue-200 text-xs font-bold flex items-center justify-center flex-shrink-0" aria-hidden="true">2</span>
                  <span className="text-sm text-gray-300">加入同行成員（最少 2 位）</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600/30 text-blue-200 text-xs font-bold flex items-center justify-center flex-shrink-0" aria-hidden="true">3</span>
                  <span className="text-sm text-gray-300">記低第一筆使費，自動幫大家計數</span>
                </li>
              </ol>
            </div>
          )}
          </div>

          {/* Right column: join / recent / create */}
          <div>
          {/* #1: Join existing trip */}
          <div className="bg-[#1c1c1e] rounded-2xl p-4 mb-6 border border-gray-800">
            <div className="text-sm text-gray-400 mb-2">🔗 加入旅程</div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                className="w-full min-w-0 p-3 bg-black rounded-xl border border-gray-700 text-center tracking-widest uppercase font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                placeholder="輸入旅程碼"
                aria-label="旅程碼"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={8}
                onKeyDown={(e) => e.key === 'Enter' && onJoin()}
              />
              <button
                onClick={onJoin}
                className="min-h-11 flex-shrink-0 px-5 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                加入
              </button>
            </div>
          </div>

          {/* #9: Recent trips */}
          {recentTrips.length > 0 && (
            <div className="mb-6">
              <div className="text-sm text-gray-400 mb-2">📋 最近旅程</div>
              <div className="space-y-2">
                {recentTrips.map(trip => (
                  <div
                    key={trip.code}
                    className="flex items-center bg-[#1c1c1e] rounded-xl border border-gray-800 hover:bg-gray-800/80 transition-colors overflow-hidden"
                  >
                    <button
                      onClick={() => onOpenTrip(trip.code)}
                      className="flex-1 min-w-0 flex items-center justify-between p-3 text-left"
                      aria-label={`開啟旅程 ${trip.name}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{trip.name}</div>
                        <div className="text-xs text-gray-400 font-mono">{trip.code}</div>
                      </div>
                      <div className="text-xs text-gray-400 flex-shrink-0 ml-2">{trip.date}</div>
                    </button>
                    <button
                      onClick={() => {
                        setRecentTrips(prev => {
                          const updated = prev.filter(t => t.code !== trip.code);
                          if (typeof window !== 'undefined') {
                            try {
                              localStorage.setItem('tripUtility_recentTrips', JSON.stringify(updated));
                            } catch {
                              // ignore (private mode / quota)
                            }
                          }
                          return updated;
                        });
                      }}
                      className="min-w-11 min-h-11 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                      aria-label={`移除 ${trip.name} 出最近旅程`}
                      title="移除"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 border-t border-gray-800" />
            <span className="text-gray-500 text-xs">或者建立新旅程</span>
            <div className="flex-1 border-t border-gray-800" />
          </div>

          <input
          className="w-full p-4 bg-[#1c1c1e] rounded-xl mb-4 border border-gray-800"
          placeholder="旅程名稱 (如: 東京之旅)"
          aria-label="旅程名稱"
          value={tripName}
          onChange={(e) => setTripName(e.target.value)}
          />

          {/* #5: Member avatar preview */}
          {memberNames.some(n => n.trim()) && (
            <div className="flex gap-2 mb-3 px-1">
              {memberNames.filter(n => n.trim()).map((n, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: getAvatarColor(i) }}
                >
                  {getAvatarText(n.trim())}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 mb-6">
              {memberNames.map((n, i) => (
              <div key={i} className="flex gap-2">
                  <input
                      className="flex-1 p-4 bg-[#1c1c1e] rounded-xl border border-gray-800"
                      placeholder={`成員 ${i + 1}（如：${MEMBER_NAME_EXAMPLES[i % MEMBER_NAME_EXAMPLES.length]}）`}
                      aria-label={`成員 ${i + 1} 名稱`}
                      value={n}
                      onChange={(e) => {
                      const next = [...memberNames];
                      next[i] = e.target.value;
                      setMemberNames(next);
                      }}
                  />
                  {memberNames.length > 2 && (
                      <button
                        onClick={() => setMemberNames(memberNames.filter((_, idx) => idx !== i))}
                        className="min-w-11 px-4 py-3 bg-[#1c1c1e] rounded-xl border border-gray-800 text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        aria-label={`移除成員 ${i + 1}`}
                      >
                        ✕
                      </button>
                  )}
              </div>
              ))}
          </div>

          <div className="flex gap-2">
              <button
                onClick={() => setMemberNames([...memberNames, ""])}
                className="min-w-11 min-h-11 px-4 py-3 bg-[#1c1c1e] rounded-xl border border-gray-800 text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                aria-label="新增一位成員"
              >
                  +
              </button>
              <button
                onClick={onCreate}
                disabled={submitting}
                className="flex-1 min-h-11 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> 建立中...</> : '🚀 開始旅程'}
              </button>
          </div>

          {/* 預告下一步：令建立完嗰版「記低旅程碼」唔會突兀，減少反射性撳走 */}
          <p className="mt-3 text-center text-xs text-gray-500">
            開完會有個 8 位旅程碼，記得分享落群組留底
          </p>
          </div>
        </div>

          {/* Footer Branding */}
          <div className="mt-10 text-center">
            <a
              href="https://www.instagram.com/midlife_ai_hk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <span>Made by</span>
              <span className="font-medium">@midlife_ai_hk</span>
            </a>
          </div>
      </div>
    </div>
  );
}
