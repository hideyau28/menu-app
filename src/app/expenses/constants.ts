// 支出類別、幣種、頭像顏色等常數 + 純顯示 helper（由 page.tsx 抽出）

export const CATEGORIES = [
  { id: "dining", label: "餐飲", icon: "🍽️" },
  { id: "transport", label: "交通", icon: "🚗" },
  { id: "hotel", label: "住宿", icon: "🏨" },
  { id: "shopping", label: "購物", icon: "🛍️" },
  { id: "activity", label: "活動", icon: "🎡" },
  { id: "other", label: "其他", icon: "📝" },
];

export const CATEGORY_COLORS: Record<string, string> = {
  dining: '#3b82f6',    // blue
  transport: '#f97316', // orange
  hotel: '#a855f7',     // purple
  shopping: '#ec4899',  // pink
  activity: '#10b981',  // green
  other: '#6b7280',     // gray
};

export const CURRENCIES = [
  { code: 'HKD', label: 'HKD 港幣', flag: '🇭🇰' },
  { code: 'JPY', label: 'JPY', flag: '🇯🇵' },
  { code: 'USD', label: 'USD', flag: '🇺🇸' },
  { code: 'CNY', label: 'CNY', flag: '🇨🇳' },
  { code: 'EUR', label: 'EUR', flag: '🇪🇺' },
  { code: 'GBP', label: 'GBP', flag: '🇬🇧' },
  { code: 'CAD', label: 'CAD', flag: '🇨🇦' },
  { code: 'KRW', label: 'KRW', flag: '🇰🇷' },
  { code: 'TWD', label: 'TWD', flag: '🇹🇼' },
  { code: 'THB', label: 'THB', flag: '🇹🇭' },
  { code: 'AUD', label: 'AUD', flag: '🇦🇺' },
  { code: 'OTHER', label: '其他幣種...', flag: '🌍' },
] as const;

export const AVATAR_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4', // cyan
];

export const getAvatarColor = (index: number) => {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
};

export const TOAST_STYLE = {
  success: { background: '#10b981', color: 'white', border: 'none' },
  error: { background: '#ef4444', color: 'white', border: 'none' },
} as const;

export const TOAST_DURATION = { success: 2000, error: 3000 } as const;

export const MEMBER_NAME_EXAMPLES = ['阿明', 'Alex', '阿May', '小強', '阿珍', '阿東', 'Kelly', '阿傑'];

export const getAvatarText = (name: string) => {
  if (!name) return '?';

  // Check if the first character is ASCII (English/Latin)
  const firstChar = name.charAt(0);
  const isAscii = firstChar.charCodeAt(0) < 128;

  if (isAscii) {
    // For ASCII/English names, take the first 2 letters and uppercase
    return name.slice(0, 2).toUpperCase();
  } else {
    // For Chinese/other names, take the first character
    return name.slice(0, 1);
  }
};
