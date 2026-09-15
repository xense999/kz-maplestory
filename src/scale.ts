import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * 把畫面鎖回設計時的比例。
 *
 * Windows 的「顯示縮放」WebView2 處理得對——整體等比放大，版面不受影響。
 * 壞掉的是「放大文字」（設定 → 協助工具 → 文字大小）：WebView2 把它併進整頁縮放，
 * 但視窗大小的計算不含它。結果是同一個視窗裡裝著被放大的內容，版面就被擠掉。
 *
 * 這裡不去讀登錄檔猜它放大了多少，而是直接量：
 * 視窗的邏輯寬度（不含文字放大）除以網頁量到的寬度（含文字放大）＝ 被多放大的倍率。
 * 量出來不是 1 就用縮放把它抵銷掉，再量一次確認——這樣不必假設 WebView2
 * 內部怎麼疊這些倍率，收斂了就是對的。
 */
export async function lockScale() {
  const win = getCurrentWindow();
  const view = getCurrentWebview();
  let zoom = 1;

  // 最多三輪：抵銷本身會再觸發一次版面重算，量到的值要等它落定
  for (let i = 0; i < 3; i++) {
    await nextFrame();
    const logical = (await win.innerSize()).toLogical(await win.scaleFactor());
    const measured = window.innerWidth;
    if (!measured) return;

    const off = logical.width / measured;
    if (Math.abs(off - 1) < 0.01) return;

    zoom /= off;
    try {
      await view.setZoom(zoom);
    } catch {
      // 沒有這個權限就算了：版面會被擠，但不該因此整個開不起來
      return;
    }
  }
}

function nextFrame() {
  return new Promise<void>((done) => requestAnimationFrame(() => done()));
}
