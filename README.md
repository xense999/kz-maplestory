# 久世管理器

楓之谷的桌面小工具。目前只有一個功能：**輪燒計時器**。

Windows 桌面程式（Tauri 2 + Vue 3 + TypeScript + Rust）。

## 它在做什麼

一頁三個計時器：

| 計時器 | 時長 | 怎麼起算 |
| --- | --- | --- |
| 出租計時 | 30 分 / 1 小時 / 1 小時 30 分 / 2 小時 / 3 小時 / 自訂（15 分為單位） | 下面任一張卡第一次觸發時跟著起算，之後一路跑到結束 |
| 輪迴計時器 | 9 分 50 秒 | 每按一次按鍵就從頭重算 |
| 燃燒計時器 | 14 分 50 秒 | 每按一次按鍵就從頭重算 |

時間到會一直響到有人處理，卡片同時轉紅。按下「停止提醒」會收鈴並把到期的那一輪歸零——
出租因此可以直接跟著下一次技能觸發開新的一輪。倒數存的是「到期時刻」而不是「還剩幾秒」，
所以電腦睡醒、視窗最小化都不會算錯。

### 按鍵不會被搶走

每張技能卡片可以綁一顆按鍵（點鍵帽錄一次，按右鍵清除，旁邊的開關打開才生效）。

這裡用的是**只監聽、不攔截**的鍵盤 hook（`WH_KEYBOARD_LL`＋`CallNextHookEx` 原樣放行），
不是系統全域快捷鍵。差別在於：全域快捷鍵一註冊，那顆鍵就從遊戲手上被拿走；
這裡則是你按下去技能照樣放得出來，計時只是順便起算。所以按鍵可以直接綁在放技能的那顆鍵上。

同一顆鍵綁在兩張卡上時，兩張都會反應。

### 浮動視窗

出租卡片右上角的「浮動視窗」按一下開、再按一下關。永遠置頂、整塊可拖、固定深色。
滑鼠停在那顆按鈕上會出現透明度拉桿（0~50%）——只有底色會變透明，數字永遠是實心的。

## 安裝

到 [Releases](https://github.com/xense999/kz-maplestory/releases) 下載 `kz-maplestory_x.y.z_x64-setup.exe`。

裝好之後，設定頁（左上角齒輪）→ 右下角的 `i` → 「檢查更新」可以直接更新到新版，不必再手動下載。

## 開發

```powershell
npm install
npm run tauri dev     # dev server 固定 1440 埠
npm run build         # vue-tsc 型別檢查 + 前端打包
```

## 發版

推一個 `v` 開頭的 tag，GitHub Actions 會自動 build 並建立 Release：

```powershell
# 1. 三處版號要對齊：package.json / src-tauri/Cargo.toml / src-tauri/tauri.conf.json
# 2. 寫 release-notes/v<版號>.md（沒寫的話 Release 內文退回 _default.md）
git tag v0.1.0
git push origin v0.1.0
```

Release 會附兩個檔案：安裝檔（給人下載）與裸 `kz-maplestory.exe`（給程式內更新就地置換）。
**因此任何執行期需要的檔案都必須編進 exe，不能只放進 `bundle.resources`** ——
那種檔案到不了用程式內更新的人手上。

## 結構

| 路徑 | 作用 |
| --- | --- |
| `src/nav.ts` | 導覽列＝這張表。加功能頁只要寫一支 `views/*.vue` 再加一列 |
| `src/styles.css` | 全站唯一的樣式來源（token 在 §1） |
| `src/stores/burn.ts` | 三個計時器的狀態與規則 |
| `src/hotkey.ts` | 監聽式熱鍵的前端介面 |
| `src/float.ts` | 浮動視窗的開關、透明度與跨視窗同步 |
| `src/FloatApp.vue` | 浮動視窗本身（同一份前端，`index.html?view=float`） |
| `src-tauri/src/keyhook.rs` | `WH_KEYBOARD_LL`，只看不攔，按鍵照樣送給遊戲 |
| `src-tauri/src/update.rs` | 程式內更新（GitHub Releases → 換掉 exe → 重啟） |
