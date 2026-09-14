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

/**
 * 欄位裡的文字轉成數字。填不出數字（空的、亂打的）一律是 NaN，
 * 由呼叫端決定那代表「還沒填」還是「算不出來」。
 * 使用者可能連千分位一起貼進來，所以逗號先拿掉。
 */
export function parseAmount(text: string): number {
  const cleaned = text.replace(/[,\s]/g, "");
  return cleaned ? Number(cleaned) : Number.NaN;
}

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

function usable(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
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

/**
 * 台幣↔楓幣來回換算會累積浮點誤差（3 會變成 3.0000000000000004）。
 * 這個門檻比誤差大得多、又比任何有意義的金額小，用來把那種尾巴當成 0。
 */
const EPS = 1e-9;

export interface Spend {
  /** 實際要掏出來的台幣，整數 */
  ntd: number;
  /** 因為湊成整數而比要求多拿到的楓幣。精確值本來就是整數時是 0 */
  extra: number;
}

/**
 * 實際要付多少錢。
 *
 * ★一律無條件進位到整數：台幣付不出小數，而少付一塊就換不到要的量。
 * 湊上去的那一點不會白花，會變成多拿的楓幣，所以一起回傳。
 */
export function spend(ntd: number, rateW: number, vip: boolean): Spend | null {
  const exact = fromNtd(ntd, rateW, vip);
  if (!exact) return null;

  const target = Math.ceil(ntd - EPS);
  const rounded = fromNtd(target, rateW, vip);
  if (!rounded) return null;

  return { ntd: target, extra: rounded.net - exact.net };
}

/**
 * 台幣填回輸入欄時的寫法：無條件進位到整數。
 * ★不能四捨五入也不留小數——台幣付不出小數，而少付一塊就換不到要的量。
 * 這跟 `spend` 回的數字是同一個，畫面上兩處才不會各說各話。
 */
export function ntdToText(ntd: number): string {
  if (!Number.isFinite(ntd)) return "";
  return String(Math.ceil(ntd - EPS));
}

/**
 * 楓幣填回輸入欄時的寫法：楓幣本身、帶千分位，捨去方向跟 formatMeso 一致。
 * 千分位進得了欄位也出得來——`parseAmount` 會把逗號拿掉。
 */
export function mesoToText(meso: number): string {
  if (!Number.isFinite(meso)) return "";
  return formatRaw(meso);
}

/**
 * 楓幣欄位的文字，換成談價會用到的級距。一長串零看不出是多少，換個講法才有感。
 * 不吃匯率，所以匯率還沒填也顯示得出來；填不出數字就回空字串，讓呼叫端直接不顯示。
 */
export function mesoTextInWords(text: string): string {
  const meso = parseAmount(text);
  return Number.isFinite(meso) && meso >= 0 ? formatMeso(meso) : "";
}

/** 千分位。自己分組而不是 toLocaleString：那個會跟著系統地區變 */
function groups(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 原始數字，例如 26,600,000。欄位裡填的就是這個寫法 */
function formatRaw(meso: number): string {
  if (!Number.isFinite(meso)) return "—";
  const sign = meso < 0 ? "-" : "";
  return sign + groups(String(Math.floor(Math.abs(meso))));
}

/** 小數點後最多兩位，尾巴的 0 不留。無條件捨去——進位會讓 9,999.9999萬 變成看起來像一億 */
function trimmed(value: number): string {
  const truncated = Math.floor(value * 100) / 100;
  const [int, frac] = truncated.toFixed(2).split(".");
  const rest = frac.replace(/0+$/, "");
  return groups(int) + (rest ? `.${rest}` : "");
}

/**
 * 談價時講的寫法：不到一億就寫「萬」（`2,660萬`），滿一億才進位成
 * `1,400 億`，有零頭寫成 `1,400 億 2,660萬`。
 */
export function formatMeso(meso: number): string {
  if (!Number.isFinite(meso)) return "—";
  const sign = meso < 0 ? "-" : "";
  const m = Math.floor(Math.abs(meso));

  const yi = Math.floor(m / YI);
  const restW = (m - yi * YI) / W;

  if (yi === 0) return `${sign}${trimmed(restW)}萬`;

  const head = `${sign}${groups(String(yi))} 億`;
  // 零頭不到 0.01 萬就不寫——寫出來是「1,400 億 0萬」這種沒意義的尾巴
  return restW >= 0.01 ? `${head} ${trimmed(restW)}萬` : head;
}
