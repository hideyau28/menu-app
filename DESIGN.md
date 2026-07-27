---
name: 旅程記帳 — Neon Night Routes
description: 為香港朋友自由行而設的城市夜遊／霓虹航線視覺系統
---

<!-- SEED: established with the user before implementation; re-run $impeccable document once there's code to capture the actual tokens and components. -->

# Design System: Neon Night Routes

## Overview

**Creative North Star: "The City Is the Ledger"**

每一筆開支都係旅程路線上一個站。介面唔再係深色 Dashboard，而係一張仍然行緊嘅夜間城市路線圖：旅程碼係路線識別、成員係同行節點、Quick Add 係下一個落點、結算係旅程終點。表達力集中喺一條會隨狀態改變嘅霓虹航線，其餘資料保持精準、清晰、易掃。

視覺要有香港夜遊嘅速度、密度同光感，但唔複製招牌字體或堆砌 Cyberpunk 效果。霓虹係資訊導航，不是裝飾；大面積深夜色讓金額、名字及操作保持可讀。

**Key Characteristics:**
- 一條有功能意義的城市航線貫穿主要流程。
- 非對稱但高度可掃描的 mobile-first composition。
- 霓虹顏色只標示路線、狀態及主要操作。
- 金額與旅程碼使用交通資訊式數字語言。
- 夜間層次來自深色場域、局部光源及細緻反射，不靠大量玻璃卡。

## Colors

Full-palette 夜間系統：深藍黑承載大部分畫面，三種訊號色有固定職責。

### Primary
- **Electric Route Cyan** (#5EEBFF): 主要航線、focus、可繼續的下一步。
- **Transit Magenta** (#FF3D9A): 關鍵分支、付款／要付狀態及夜遊能量。

### Secondary
- **Signal Amber** (#FFB84D): 匯率、編輯模式、需注意但非錯誤的狀態。

### Neutral
- **Night Asphalt** (#05060A): 全頁基底。
- **Midnight Platform** (#0B1020): 主要操作場域。
- **Elevated Ink** (#141B2D): 次級控制及資料面板。
- **Cloud White** (#F5F7FF): 主要文字及金額。
- **Mist Blue** (#AAB6CF): AA 友善的次要文字。

**The Signal Has a Job Rule.** Cyan、Magenta、Amber 不可互換；每種顏色必須代表動作、分支或狀態。

## Typography

**Display Direction:** 窄身交通資訊字形，用於旅程名、目的地及大金額；中文字以 Noto Sans HK Heavy 類型保持清楚。
**Body Direction:** 現代香港黑體，字面開放，戶外小屏幕仍可讀。
**Data Direction:** Tabular mono／condensed numerals，只用於旅程碼、時間、匯率及金額資料。

**Character:** 似夜間港鐵路線牌與演唱會入場資訊的混合體：強方向感、短句、數字一眼可讀，但不把整個介面扮成終端機。

**The Data Stays Still Rule.** 所有金額使用 tabular numerals；光效及動態不可令數字位移或難以比較。

## Layout

手機主畫面以「路線」而非卡片堆疊組織。旅程 Header 是起點，Quick Add 是最大站點，總額與結算沿同一路徑向下展開。主要 CTA 在 390×844 首屏內；進階分帳仍以 disclosure 收起。

桌面版改為城市控制台式非對稱雙欄：左欄固定旅程狀態及結算路線，右欄承載 Quick Add 與記錄；不可只放大手機窄欄。8px 基礎節奏，主要區域以 24–32px 分隔，資訊群組內維持 8–12px。

## Elevation & Depth

以 tonal layering 為主、局部訊號光為輔。主要面板像夜間站台顯示器，使用內側高光、極淡環境反射及有方向的柔光；不使用每張卡都有相同外框與 glow 的做法。

**The One Live Line Rule.** 每個 viewport 只容許一條主航線成為光源；其他表面安靜，避免全畫面發光。

## Shapes

主要操作面板採用略帶切角或路線轉角的幾何輪廓；小型狀態及成員節點可以圓形。Pill 只留給細小狀態、語言切換及路線識別，不把所有按鈕做成膠囊。

## Do's and Don'ts

### Do:
- **Do** 讓航線節點對應真實流程、成員或結算狀態。
- **Do** 保留清晰可見的 Quick Add、金額 Label 及 44px touch targets。
- **Do** 讓霓虹集中於一個主視覺時刻，其餘資料保持安靜。
- **Do** 以 reduced-motion 提供完全靜態但同樣清晰的版本。

### Don't:
- **Don't** 回到通用黑底、灰色圓角卡、單一藍色 CTA。
- **Don't** 堆滿 glow、glass、網格背景或無意義浮動粒子。
- **Don't** 用霓虹色承載細小正文，或以光暈代替足夠對比。
- **Don't** 改動金額、匯率、分帳、還款或資料結構。
