import { Trash2 } from "lucide-react";

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onClose: () => void;
}

// 刪除確認 modal
export function ConfirmModal({ message, onConfirm, onClose }: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-[#2c2c2e] rounded-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mb-3">
            <Trash2 className="w-6 h-6 text-red-400" aria-hidden="true" />
          </div>
          <div className="text-base font-semibold">
            {message}
          </div>
          <div className="text-xs text-gray-400 mt-1">呢個動作冇得復原</div>
        </div>
        <div className="flex border-t border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-blue-400 font-medium border-r border-gray-700 active:bg-gray-700/50"
          >
            取消
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-3 text-red-400 font-bold active:bg-gray-700/50"
          >
            確定刪除
          </button>
        </div>
      </div>
    </div>
  );
}
