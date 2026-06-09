interface FavoritesModalProps {
  onClose: () => void;
}

// 「如何收藏此 App」教學 modal
export function FavoritesModal({ onClose }: FavoritesModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1c1c1e] rounded-2xl p-6 max-w-md w-full border border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">⭐ 如何收藏此 App？</h2>
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
          onClick={onClose}
          className="w-full mt-6 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-colors"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
