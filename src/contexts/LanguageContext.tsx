"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'zh' | 'en';

interface Translations {
  // UI Labels
  totalExpense: string;
  currency: string;
  amount: string;
  date: string;
  note: string;
  whoPaid: string;
  whoSplit: string;
  selectAll: string;
  deselectAll: string;
  splitMode: string;
  equalSplit: string;
  customSplit: string;
  exchangeRate: string;
  enterCurrencyCode: string;

  // Section Headers
  balances: string;
  settlements: string;
  recordList: string;

  // Buttons & Actions
  tripNotFound: string;
  refreshPage: string;
  export: string;
  share: string;
  favorite: string;
  newTrip: string;
  refresh: string;
  addRecord: string;
  updateRecord: string;
  cancel: string;
  delete: string;
  editMode: string;

  // Categories
  dining: string;
  transport: string;
  hotel: string;
  shopping: string;
  activity: string;
  other: string;

  // Status & Messages
  noRecords: string;
  noSettlements: string;
  totalPaid: string;
  totalConsumed: string;
  balance: string;
  paid: string;
  consumed: string;
  even: string;
  records: string;

  // Create Trip
  createTrip: string;
  tripName: string;
  tripNamePlaceholder: string;
  member: string;
  startTrip: string;

  // Error Messages
  incompleteData: string;
  pleaseEnterRate: string;
  splitAmountMismatch: string;
  enterAllSplits: string;
}

const translations: Record<Language, Translations> = {
  zh: {
    // UI Labels
    totalExpense: '總開支',
    currency: '幣別',
    amount: '金額',
    date: '日期',
    note: '備註',
    whoPaid: '誰付錢',
    whoSplit: '誰分擔',
    selectAll: '全選',
    deselectAll: '全不選',
    splitMode: '分擔方式',
    equalSplit: '平均分擔',
    customSplit: '詳細輸入',
    exchangeRate: '匯率',
    enterCurrencyCode: '輸入幣種代碼',

    // Section Headers
    balances: '結餘狀況',
    settlements: '建議還款方案',
    recordList: '記錄列表',

    // Buttons & Actions
    tripNotFound: '找不到旅程',
    refreshPage: '重新整理頁面',
    export: '匯出',
    share: '分享',
    favorite: '收藏',
    newTrip: '新旅程',
    refresh: '刷新',
    addRecord: '新增記錄',
    updateRecord: '更新記錄',
    cancel: '取消',
    delete: '刪除',
    editMode: '編輯模式',

    // Categories
    dining: '餐飲',
    transport: '交通',
    hotel: '住宿',
    shopping: '購物',
    activity: '活動',
    other: '其他',

    // Status & Messages
    noRecords: '暫無記錄',
    noSettlements: '暫無須結算',
    totalPaid: '總墊支',
    totalConsumed: '總消費',
    balance: '淨結餘',
    paid: '代墊金額',
    consumed: '消費金額',
    even: '平手',
    records: '筆記錄',

    // Create Trip
    createTrip: '建立新旅程',
    tripName: '旅程名稱',
    tripNamePlaceholder: '旅程名稱 (如: 東京之旅)',
    member: '成員',
    startTrip: '開始旅程',

    // Error Messages
    incompleteData: '資料不完整',
    pleaseEnterRate: '請先輸入',
    splitAmountMismatch: '分擔金額總和不正確',
    enterAllSplits: '請輸入所有參與者的分擔金額',
  },
  en: {
    // UI Labels
    totalExpense: 'Total Expense',
    currency: 'Currency',
    amount: 'Amount',
    date: 'Date',
    note: 'Note',
    whoPaid: 'Who Paid',
    whoSplit: 'Split With',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    splitMode: 'Split Mode',
    equalSplit: 'Equal Split',
    customSplit: 'Custom Split',
    exchangeRate: 'Exchange Rate',
    enterCurrencyCode: 'Enter Currency Code',

    // Section Headers
    balances: 'Balances',
    settlements: 'Suggested Repayments',
    recordList: 'Record List',

    // Buttons & Actions
    tripNotFound: 'Trip Not Found',
    refreshPage: 'Refresh Page',
    export: 'Export',
    share: 'Share',
    favorite: 'Favorite',
    newTrip: 'New Trip',
    refresh: 'Refresh',
    addRecord: 'Add Record',
    updateRecord: 'Update Record',
    cancel: 'Cancel',
    delete: 'Delete',
    editMode: 'Edit Mode',

    // Categories
    dining: 'Dining',
    transport: 'Transport',
    hotel: 'Hotel',
    shopping: 'Shopping',
    activity: 'Activity',
    other: 'Other',

    // Status & Messages
    noRecords: 'No Records',
    noSettlements: 'No Settlements',
    totalPaid: 'Total Paid',
    totalConsumed: 'Total Consumed',
    balance: 'Balance',
    paid: 'Paid',
    consumed: 'Share',
    even: 'Even',
    records: 'records',

    // Create Trip
    createTrip: 'Create New Trip',
    tripName: 'Trip Name',
    tripNamePlaceholder: 'Trip Name (e.g., Tokyo Trip)',
    member: 'Member',
    startTrip: 'Start Trip',

    // Error Messages
    incompleteData: 'Incomplete Data',
    pleaseEnterRate: 'Please enter',
    splitAmountMismatch: 'Split amount mismatch',
    enterAllSplits: 'Please enter all split amounts',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('zh');

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
