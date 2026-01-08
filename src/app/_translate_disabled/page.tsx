"use client";

import { useState } from "react";
import { Camera, Upload, Copy, Languages, X, Loader2 } from "lucide-react";
import { toast, Toaster } from "sonner";

export default function TranslatePage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState("");

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const maxSize = 1200; // 稍微提升清晰度利於 OCR
          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setSelectedImage(compressed);
      setTranslatedText("");
    } catch {
      toast.error("圖片處理失敗");
    }
  };

  const handleTranslate = async () => {
    if (!selectedImage) return;
    setIsTranslating(true);
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: selectedImage }),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setTranslatedText(data.translatedText || "無法提取文字");
    } catch {
      toast.error("翻譯失敗，請檢查 API 設定");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setTranslatedText("");
  };

  return (
    // pb-48 確保內容底部有足夠滾動空間
    <div className="min-h-screen bg-black text-white pb-48 overflow-y-auto">
      <Toaster position="top-center" theme="dark" />

      {/* Header */}
      <div className="max-w-2xl mx-auto p-6 pt-12">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Languages className="w-8 h-8 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold">翻譯</h1>
              <p className="text-sm text-gray-500">自動偵測 → 繁體中文</p>
            </div>
          </div>
          {selectedImage && (
            <button onClick={handleReset} className="p-2 bg-zinc-800 rounded-full text-gray-400">
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {!selectedImage ? (
          <div className="grid grid-cols-1 gap-4 text-center">
            <label className="cursor-pointer">
              <input type="file" accept="image/*" capture="environment" onChange={handleImageCapture} className="hidden" />
              <div className="py-20 rounded-[2.5rem] bg-zinc-900 border border-zinc-800">
                <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-xl font-bold">拍照翻譯</p>
              </div>
            </label>
          </div>
        ) : (
          <div className="space-y-6">
            <img src={selectedImage} className="w-full rounded-3xl border border-zinc-800 shadow-2xl" />
            {isTranslating && (
              <div className="flex flex-col items-center py-12 space-y-4">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="text-gray-400 font-medium">幫緊你，幫緊你...</p>
              </div>
            )}
            {!isTranslating && translatedText && (
              <div className="p-6 bg-zinc-900 rounded-[2rem] border border-zinc-800 shadow-xl">
                <div className="flex justify-between mb-4 items-center">
                  <span className="text-blue-400 text-xs font-bold uppercase tracking-widest">翻譯結果</span>
                  <Copy className="w-5 h-5 text-gray-500 cursor-pointer" onClick={() => {
                    navigator.clipboard.writeText(translatedText);
                    toast.success("已複製");
                  }} />
                </div>
                <p className="text-lg text-white leading-relaxed">{translatedText}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 🚀 底部浮動按鈕區 - 避開導航欄 */}
      {selectedImage && !isTranslating && (
        <div className="fixed bottom-[100px] left-0 right-0 px-8 z-50">
          <div className="max-w-2xl mx-auto">
            {!translatedText ? (
              <button onClick={handleTranslate} className="w-full py-5 bg-blue-600 active:scale-95 transition-all rounded-[1.5rem] text-white font-bold text-xl shadow-2xl">
                開始翻譯
              </button>
            ) : (
              <button onClick={handleReset} className="w-full py-5 bg-white text-black active:scale-95 transition-all rounded-[1.5rem] font-bold text-xl shadow-2xl">
                再影過一張
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}