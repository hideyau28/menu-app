import { useEffect, useState } from "react";
import { Share2, Copy, Check, ArrowRight } from "lucide-react";

interface TripCreatedScreenProps {
  tripName: string;
  code: string;
  memberCount: number;
  onShare: () => void;
  onCopyCode: () => void;
  onEnter: () => void;
}

// 撳走之前嘅緩衝秒數：防止建立完反射性撳走，連旅程碼都未望過
const DISMISS_DELAY_SECONDS = 3;

/**
 * 建立流程第二步：喺入記帳頁之前，逼旅程碼離開部機。
 *
 * 點解需要呢一版：旅程碼係入返個旅程嘅唯一鎖匙，但佢淨係存喺部機
 * （localStorage `tripUtility_recentTrips` + 30 日 `last_trip_code` cookie）。
 * 清 cache / 換機 / 無痕模式 = 永久失聯，要入 DB 先撈得返。
 * 個碼一直都喺 header 顯示得到，但「被動擺喺度」打唔贏一次清 cache，
 * 所以要喺建立嗰刻造一個主動推出去嘅時刻。
 *
 * 刻意做成一版畫面而唔係 modal：冇 X 掣、冇 backdrop，撳外面走唔到，
 * 睇落係流程一部分，唔會觸發用家對彈窗嘅反射性關閉。
 */
export function TripCreatedScreen({
  tripName,
  code,
  memberCount,
  onShare,
  onCopyCode,
  onEnter,
}: TripCreatedScreenProps) {
  const [saved, setSaved] = useState(false);
  const [countdown, setCountdown] = useState(DISMISS_DELAY_SECONDS);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // 摩擦，唔係閘：share / copy 過就即刻入得，冇做過都只係等 3 秒
  const canEnter = saved || countdown <= 0;

  const handleShare = () => {
    setSaved(true);
    onShare();
  };

  const handleCopy = () => {
    setSaved(true);
    onCopyCode();
  };

  return (
    <div className="min-h-[100dvh] bg-night-asphalt px-4 py-10 text-cloud-white">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-sm flex-col">
        <div className="flex-1">
          {/* 建立成功 */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-route-cyan/15">
              <Check className="h-7 w-7 text-route-cyan" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">旅程已建立</h1>
            <p className="mt-1 text-sm text-mist-blue">
              {tripName} · {memberCount} 位成員
            </p>
          </div>

          {/* 旅程碼 */}
          <div className="rounded-2xl border border-route-cyan/30 bg-elevated-ink p-5 text-center">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-mist-blue">
              Trip Code
            </div>
            <div className="font-mono text-4xl font-bold tracking-[0.2em] text-route-cyan">
              {code}
            </div>
          </div>

          {/* 後果講清楚 */}
          <p className="mt-4 text-center text-sm leading-relaxed text-mist-blue">
            呢個係入返呢個旅程嘅<span className="font-bold text-signal-amber">唯一鎖匙</span>。
            換機、清 cache、或者部機唔見咗，冇呢個碼就搵唔返盤數。
          </p>

          {/* 主要動作：推個碼離開部機 */}
          <div className="mt-6 space-y-3">
            <button
              onClick={handleShare}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-route-cyan font-bold text-night-asphalt transition-colors hover:bg-route-cyan/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-night-asphalt"
            >
              <Share2 className="h-5 w-5" aria-hidden="true" />
              分享去群組
            </button>
            <button
              onClick={handleCopy}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-elevated-ink font-medium text-cloud-white transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-night-asphalt"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              複製旅程碼
            </button>
          </div>
        </div>

        {/* 入記帳頁：share / copy 過變主掣，未做過就等 3 秒 */}
        <div className="pt-8">
          <button
            onClick={onEnter}
            disabled={!canEnter}
            className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-night-asphalt ${
              saved
                ? "bg-white/10 text-cloud-white hover:bg-white/15"
                : "border border-white/10 text-mist-blue hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            }`}
          >
            {saved ? "搞掂，開始記帳" : canEnter ? "稍後再儲" : `稍後再儲（${countdown}）`}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          {!saved && (
            <p className="mt-3 text-center text-xs text-mist-blue">
              旅程碼之後喺記帳頁頂都搵到
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
