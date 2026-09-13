# 久世管理器（kz-maplestory）

楓之谷的桌面小工具，Tauri 2 + Vue 3 + TypeScript。目前只有一個功能頁：輪燒計時器。

## 開發

```powershell
npm install
npm run tauri dev     # dev server 固定 1440 埠
npm run build         # 型別檢查 + 前端打包
```

## 發版

打 tag 就會由 GitHub Actions 自動 build 並建立 Release：

```powershell
# 1. 先把 package.json 與 src-tauri/{Cargo.toml,tauri.conf.json} 的版號改成同一個
# 2. 寫 release-notes/v<版號>.md（沒寫的話 Release 內文會退回 _default.md）
git tag v0.1.0
git push origin v0.1.0
```

工作流程在 `.github/workflows/release.yml`，Release 內文直接取 `release-notes/<tag>.md`。

## 結構

| 路徑 | 作用 |
| --- | --- |
| `src/nav.ts` | 導覽列＝這張表。加功能頁只要寫一支 `views/*.vue` 再加一列 |
| `src/styles.css` | 全站唯一的樣式來源（token 在 §1） |
| `src/stores/burn.ts` | 三個計時器的狀態與規則 |
| `src/hotkey.ts` | 監聽式熱鍵的前端介面 |
| `src-tauri/src/keyhook.rs` | `WH_KEYBOARD_LL`，只看不攔，按鍵照樣送給遊戲 |
| `src/FloatApp.vue` | 浮動視窗（同一份前端，`index.html?view=float`） |
