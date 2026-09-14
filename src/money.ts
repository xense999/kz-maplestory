/**
 * 幣值換算：用台幣跟其他玩家買楓幣時，交易手續費怎麼算。
 *
 * 遊戲把手續費從轉過來的楓幣裡扣，所以「談好的數字」與「實際入手的數字」是兩件事。
 * 這裡是那組算術與顯示寫法的唯一來源——純函式，不碰 Vue 也不碰 Tauri，所以測得動。
 *
 * 單位約定：
 * - 對外的金額一律以**楓幣**為單位（遊戲裡的最小單位）。
 * - 匯率的單位是 **W／台幣**（玩家談價時講的就是這個，直接填 2800）。
 * - `W` 是「萬楓幣」，畫面上的輸入欄用它，換算進來時乘 `W`。
 */

/** 1W ＝ 一萬楓幣 */
export const W = 10_000;

/** 1 億楓幣 */
export const YI = 100_000_000;

/**
 * 手續費率寫成整數百分比而不是 0.05。
 * 浮點數的 0.05 不是精確值，乘完會冒出 26600000.000000004 這種尾巴；
 * 先乘百分比再除 100，常見的金額都落在整數上。
 */
export const FEE_PERCENT_NORMAL = 5;
export const FEE_PERCENT_VIP = 3;

export function feePercent(vip: boolean): number {
  return vip ? FEE_PERCENT_VIP : FEE_PERCENT_NORMAL;
}

/** 一筆交易的四個數字，金額單位都是楓幣 */
export interface Deal {
  /** 要付的台幣（精確值，沒有湊整） */
  ntd: number;
  /** 跟對方談的金額 */
  face: number;
  /** 手續費扣完，實際入手 */
  net: number;
  /** 手續費吃掉的量 */
  fee: number;
}

function usable(...values: number[]): boolean {
  return values.every((v) => Number.isFinite(v) && v >= 0);
}

/** 每台幣換得到的楓幣。匯率不合法時回 0，呼叫端一律先擋掉 */
function mesoPerNtd(rateW: number): number {
  return Number.isFinite(rateW) && rateW > 0 ? rateW * W : 0;
}

/** 我付這麼多台幣，實際會入手多少楓幣 */
export function fromNtd(ntd: number, rateW: number, vip: boolean): Deal | null {
  const per = mesoPerNtd(rateW);
  if (!per || !usable(ntd)) return null;

  const face = ntd * per;
  const fee = (face * feePercent(vip)) / 100;
  return { ntd, face, net: face - fee, fee };
}

/** 我要入手這麼多楓幣，該付多少台幣 */
export function fromNet(net: number, rateW: number, vip: boolean): Deal | null {
  const per = mesoPerNtd(rateW);
  if (!per || !usable(net)) return null;

  const face = (net * 100) / (100 - feePercent(vip));
  return { ntd: face / per, face, net, fee: face - net };
}

/** 浮點數的往返誤差落在小數第 15 位上下，比這個小就當作同一個數 */
const EPS = 1e-9;

export interface RoundUp {
  /** 湊整之後要付的台幣 */
  ntd: number;
  /** 因為湊整而多拿到的楓幣 */
  extra: number;
}

/**
 * 付整數台幣的話要付多少、會多拿多少。
 * 精確值本來就是整數（或算不出來）時回 null——這時畫面上不該出現建議。
 */
export function roundUpSuggestion(
  ntd: number,
  rateW: number,
  vip: boolean,
): RoundUp | null {
  const exact = fromNtd(ntd, rateW, vip);
  if (!exact) return null;

  const target = Math.ceil(ntd - EPS);
  if (target - ntd < EPS) return null;

  const rounded = fromNtd(target, rateW, vip);
  if (!rounded) return null;

  return { ntd: target, extra: rounded.net - exact.net };
}

/** 千分位。自己分組而不是 toLocaleString：那個會跟著系統地區變 */
function groups(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 原始數字，例如 26,600,000。要照著打進遊戲的就是這個 */
export function formatRaw(meso: number): string {
  if (!Number.isFinite(meso)) return "—";
  const sign = meso < 0 ? "-" : "";
  return sign + groups(String(Math.floor(Math.abs(meso))));
}

/** 小數點後最多兩位，尾巴的 0 不留。無條件捨去——進位會讓 9,999.9999W 變成看起來像一億 */
function trimmed(value: number): string {
  const truncated = Math.floor(value * 100) / 100;
  const [int, frac] = truncated.toFixed(2).split(".");
  const rest = frac.replace(/0+$/, "");
  return groups(int) + (rest ? `.${rest}` : "");
}

/**
 * 談價時講的寫法：不到一億就純 W（`2,660W`），滿一億才進位成
 * `1,400 億`，有零頭寫成 `1,400 億 2,660W`。
 */
export function formatMeso(meso: number): string {
  if (!Number.isFinite(meso)) return "—";
  const sign = meso < 0 ? "-" : "";
  const m = Math.floor(Math.abs(meso));

  const yi = Math.floor(m / YI);
  const restW = (m - yi * YI) / W;

  if (yi === 0) return `${sign}${trimmed(restW)}W`;

  const head = `${sign}${groups(String(yi))} 億`;
  // 零頭不到 0.01W 就不寫——寫出來是「1,400 億 0W」這種沒意義的尾巴
  return restW >= 0.01 ? `${head} ${trimmed(restW)}W` : head;
}
