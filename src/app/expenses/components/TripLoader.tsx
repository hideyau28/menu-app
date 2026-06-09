// 載入中畫面（旅程查詢期間）
export function TripLoader() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <div className="mb-4 text-6xl animate-bounce">✈️</div>
        <div className="text-lg font-bold mb-2">旅程記帳</div>
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '0.2s' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    </div>
  );
}
