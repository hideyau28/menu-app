# Session Handoff — 2026-11-20

## Next
- 開新 session 讀 SESSION-HANDOFF.md 再接手，睇下接唔接得順

## 目標
繼續 Claude Code 課程第 2 課。下一步係試用新寫嘅 `handoff` skill。

## 已完成
- 寫好用戶級 skill `~/.claude/skills/handoff/SKILL.md`（32 行，會喺項目根目錄寫 `SESSION-HANDOFF.md`）。
- 舊版備份咗做 `~/.claude/skills/handoff/SKILL.md.bak`（舊版會將交接文件寫去 OS temp 目錄，而且設咗 `disable-model-invocation: true`）。
- 喺 menu-app 用 `/handoff` 行咗第一次，產生咗呢份文件。

## 未完成
- 未檢查呢份輸出係咪合心意（段落、詳細程度、用字）。
- 未決定 `SESSION-HANDOFF.md` 要 commit 定加入 `.gitignore`。
- 新 session 未試過讀呢份文件接手。

## 下一步第一個動作
開一個新 session，叫 Claude 讀 `SESSION-HANDOFF.md` 再接手，睇吓佢接唔接得順。

## 改過嘅檔案
- `~/.claude/skills/handoff/SKILL.md`（覆蓋咗，喺 repo 外面）
- `~/.claude/skills/handoff/SKILL.md.bak`（新增，喺 repo 外面）
- `SESSION-HANDOFF.md`（新增，即係呢份）

## 未 commit 嘅改動
- menu-app：寫呢份文件之前 working tree 係乾淨嘅；而家只多咗 `SESSION-HANDOFF.md`，未 track。
- `~/.claude/skills/` 唔喺 menu-app repo 入面，menu-app 嘅 git 唔會記錄佢嘅改動。

## 要注意嘅陷阱
- `~/.claude/skills/handoff/agents/openai.yaml` 用戶講明唔好掂。
- 新版 skill 冇設 `disable-model-invocation`，所以 Claude 可以自己叫佢（例如 context 去到 400k 嗰陣）。想要只可以手動行，就喺 frontmatter 加返呢個設定。
- 想還原舊版：`cp ~/.claude/skills/handoff/SKILL.md.bak ~/.claude/skills/handoff/SKILL.md`。
- 喺 menu-app 做嘢之前要睇項目 `CLAUDE.md` 嘅紅線（錢、schema、權限、env）。
