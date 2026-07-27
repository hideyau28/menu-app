// 純函數：組成分享旅程連結嘅 payload（title/text/url）
// 刻意淨係帶旅程名 + 連結，唔夾帶任何使費/成員等額外資料
export interface TripShareData {
  title: string;
  text: string;
  url: string;
}

const DEFAULT_TITLE = "旅程記帳";
const SHARE_TAGLINE = "一齊嚟記帳啦！by @midlife_ai_hk";

export function buildTripShareData(
  tripName: string | null | undefined,
  url: string,
): TripShareData {
  return {
    title: tripName?.trim() || DEFAULT_TITLE,
    text: SHARE_TAGLINE,
    url,
  };
}

// 將文字複製到剪貼簿：優先用 Clipboard API，用唔到 / 被拒絕就 fallback 用 execCommand。
// 呢個函數保證唔會 throw 或者拋出未處理嘅 rejection —— 用返回值話俾呼叫者知複製成唔成功。
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Clipboard API 存在但被拒絕 / 失敗 —— 跌落去用 legacy fallback
    }
  }

  if (typeof document === "undefined") return false;

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}
