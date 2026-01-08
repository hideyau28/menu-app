# Claude Project Rules — Trip Utility App

This project is a Hong Kong–focused travel utility app (Cantonese UI) built with:
- Next.js (App Router)
- React (Client Components)
- Tailwind CSS
- LocalStorage for persistence

Claude is used as an assistant for UI, layout, and productivity.
Claude is NOT allowed to change core business logic.

---

## 🔴 ABSOLUTE RULES (DO NOT VIOLATE)

Claude MUST NOT modify the following without explicit instruction:

### 1. Core Business Logic (DO NOT TOUCH)
- Expense splitting logic
- Per-person calculation logic
- Rounding / toFixed / currency math rules
- Any function that calculates totals, shares, or HKD amounts

Examples of protected logic:
- `calculateTotals`
- `expense.hkdActual` handling
- participant split logic
- null / missing HKD handling rules

❌ Do NOT refactor
❌ Do NOT “simplify”
❌ Do NOT “improve” math
❌ Do NOT change number types or rounding behavior

---

### 2. Data Structures (DO NOT MODIFY)
The following interfaces are **locked**:

```ts
interface Member {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  title: string;
  localAmount: number;
  localCurrency: string;
  hkdActual: number | null;
  participants: string[];
  timestamp: number;
}
```

❌ Do NOT add fields  
❌ Do NOT rename fields  
❌ Do NOT change types  

---

### 3. Storage Keys (DO NOT CHANGE)
LocalStorage keys are fixed and must not be renamed:

- `tripUtility_members`
- `tripUtility_expenses`
- `tripUtility_localCurrency`

---

## 🟢 WHAT CLAUDE IS ALLOWED TO DO

Claude IS encouraged to help with the following:

### UI / Layout
- JSX structure
- Tailwind class refinement
- Mobile-first spacing
- Button / card / form layout
- Readability and visual hierarchy

### Components
- Extracting UI into presentational components
- Creating reusable UI blocks (cards, rows, inputs)

### Display Logic (SAFE ONLY)
- Conditional rendering (`if`, `&&`)
- Labels, copywriting (Cantonese)
- Icons, emojis, placeholders
- Empty / loading / error states

### Pages
Claude may help improve UI for:
- `/currency`
- `/translate`
- `/weather`
- `/expenses` (UI only, NOT logic)

---

## 🟡 IMPORTANT SAFETY CONSTRAINTS

- Claude must NOT auto-refactor entire files
- Claude must NOT rewrite a page unless explicitly asked
- Claude must NOT mix UI changes with logic changes in one step

If unsure:
👉 Ask before changing

---

## 🧠 EXPECTED WORKING STYLE

Claude should work in **small, surgical changes**:
- Modify only the requested JSX block
- Keep existing state, hooks, and logic intact
- Prefer additive changes over destructive ones

---

## 🗣️ LANGUAGE & TONE

- UI text: **Natural Hong Kong Cantonese**
- Avoid Mainland Chinese phrasing
- Avoid overly formal tone
- Prioritize clarity for real travelers

---

## ✅ SUMMARY FOR CLAUDE

You are a **UI assistant and productivity helper**.

You are NOT the owner of:
- math
- money
- splitting rules
- storage schema

When in doubt:
👉 Ask.