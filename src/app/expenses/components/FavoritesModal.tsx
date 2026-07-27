import { useEffect, useRef } from "react";

interface FavoritesModalProps {
  onClose: () => void;
}

const TITLE_ID = "favorites-modal-title";

// 「如何收藏此 App」教學 modal
export function FavoritesModal({ onClose }: FavoritesModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const container = dialogRef.current;
        if (!container) return;
        const focusable = container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
    >
      <div
        ref={dialogRef}
        className="bg-[#1c1c1e] rounded-2xl p-6 max-w-md w-full border border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={TITLE_ID} className="text-xl font-bold mb-4">⭐ 如何收藏此 App？</h2>
        <div className="space-y-4 text-sm text-gray-300">
          <div>
            <div className="font-semibold text-white mb-2">📱 iOS（推薦）：</div>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>點擊下方「分享」按鈕 <span className="text-blue-400">(↑)</span></li>
              <li>選擇「加入主畫面」</li>
              <li>或選擇「加入我的最愛」</li>
            </ol>
          </div>
          <div>
            <div className="font-semibold text-white mb-2">🤖 Android：</div>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>點擊瀏覽器選單 <span className="text-blue-400">(⋮)</span></li>
              <li>選擇「安裝應用程式」或「加到主螢幕」</li>
            </ol>
          </div>
        </div>
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="w-full mt-6 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-colors"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
