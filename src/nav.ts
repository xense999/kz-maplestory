import type { Component } from "vue";
import BurnTimer from "./views/BurnTimer.vue";

/**
 * 導覽列＝這張表。要加一個新功能頁只動這裡：
 * 寫一支 views/*.vue，再往 NAV 加一列（id / 標題 / 提示 / 16×16 stroke icon）。
 * id 只在這張表與 localStorage 裡出現，其他地方不該寫死。
 */
export interface NavItem {
  id: string;
  label: string;
  hint: string;
  /** 16×16 viewBox 的 path d，統一 fill=none / stroke=currentColor */
  icon: string[];
  view: Component;
}

export const NAV: NavItem[] = [
  {
    id: "burn",
    label: "輪燒計時器",
    hint: "輪迴與燃燒的場次計時",
    icon: [
      "M8 1.9c2.6 3 4.2 5 4.2 6.9A4.2 4.2 0 0 1 8 13.9a4.2 4.2 0 0 1-4.2-4.1c0-1.9 1.6-3.9 4.2-6.9Z",
      "M8 13.9a2 2 0 0 0 2-2c0-1-.7-1.8-2-3.3-1.3 1.5-2 2.3-2 3.3a2 2 0 0 0 2 2Z",
    ],
    view: BurnTimer,
  },
];
