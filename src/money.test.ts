import { describe, expect, it } from "vitest";
import {
  formatMeso,
  ntdToText,
  mesoToText,
  mesoTextInWords,
  parseAmount,
  fromNet,
  fromNtd,
  spend,
  W,
} from "./money";

/** 常用的一組：匯率 2800W／台幣 */
const RATE = 2800;

describe("台幣 → 楓幣", () => {
  it("非 VIP 抽 5%", () => {
    const d = fromNtd(1, RATE, false)!;
    expect(d.face).toBe(2800 * W);
    expect(d.net).toBe(2660 * W);
    expect(d.fee).toBe(140 * W);
  });

  it("VIP 抽 3%", () => {
    const d = fromNtd(1, RATE, true)!;
    expect(d.face).toBe(2800 * W);
    expect(d.net).toBe(2716 * W);
    expect(d.fee).toBe(84 * W);
  });

  it("手續費就是帳面與實收的差", () => {
    const d = fromNtd(137.5, RATE, false)!;
    expect(d.fee).toBeCloseTo(d.face - d.net, 6);
  });
});

describe("楓幣 → 台幣", () => {
  it("實收 5000W 非 VIP 要付的比 5000 ÷ 匯率 多", () => {
    const d = fromNet(5000 * W, RATE, false)!;
    expect(d.ntd).toBeCloseTo(1.8797, 4);
    expect(d.net).toBe(5000 * W);
    expect(d.face).toBeCloseTo((5000 / 0.95) * W, 3);
  });

  it("反推回去等於原本的台幣", () => {
    for (const vip of [false, true]) {
      const forward = fromNtd(123.45, RATE, vip)!;
      const back = fromNet(forward.net, RATE, vip)!;
      expect(back.ntd).toBeCloseTo(123.45, 9);
    }
  });
});

describe("算不出來的輸入", () => {
  it("匯率 0 或負數一律回 null", () => {
    expect(fromNtd(100, 0, false)).toBeNull();
    expect(fromNtd(100, -2800, false)).toBeNull();
    expect(fromNet(100 * W, 0, false)).toBeNull();
  });

  it("非數字回 null", () => {
    expect(fromNtd(Number.NaN, RATE, false)).toBeNull();
    expect(fromNtd(100, Number.NaN, false)).toBeNull();
    expect(fromNet(Number.NaN, RATE, false)).toBeNull();
  });

  it("負的金額回 null", () => {
    expect(fromNtd(-1, RATE, false)).toBeNull();
    expect(fromNet(-1, RATE, false)).toBeNull();
  });

  it("0 是合法的，算出來就是 0", () => {
    const d = fromNtd(0, RATE, false)!;
    expect(d.face).toBe(0);
    expect(d.net).toBe(0);
  });
});

describe("實際花費", () => {
  it("一律進位到整數台幣，湊上去的那點變成多拿的楓幣", () => {
    const d = fromNet(5000 * W, RATE, false)!;
    const s = spend(d.ntd, RATE, false)!;
    expect(s.ntd).toBe(2);
    // 2 台幣的實收 5320W，比原本要的 5000W 多 320W
    expect(s.extra).toBeCloseTo(320 * W, 2);
  });

  it("精確值本來就是整數時沒有多拿", () => {
    const d = fromNtd(3, RATE, false)!;
    const back = fromNet(d.net, RATE, false)!;
    const s = spend(back.ntd, RATE, false)!;
    expect(s.ntd).toBe(3);
    expect(s.extra).toBeCloseTo(0, 2);
  });

  it("算不出來時回 null", () => {
    expect(spend(1.5, 0, false)).toBeNull();
    expect(spend(Number.NaN, RATE, false)).toBeNull();
  });
});

describe("欄位文字轉數字", () => {
  it("千分位一起貼進來也認得", () => {
    expect(parseAmount("2,800")).toBe(2800);
  });

  it("空的與亂打的都是 NaN，由呼叫端決定那代表什麼", () => {
    expect(parseAmount("")).toBeNaN();
    expect(parseAmount("   ")).toBeNaN();
    expect(parseAmount("abc")).toBeNaN();
  });
});

describe("台幣的寫法", () => {
  it("無條件進位到整數——台幣付不出小數，少付一塊就換不到要的量", () => {
    expect(ntdToText(1.8796992481203008)).toBe("2");
    expect(ntdToText(2.001)).toBe("3");
  });

  it("往返換算留下的浮點尾巴不會把整數推上去", () => {
    expect(ntdToText(3.0000000000000004)).toBe("3");
  });

  it("欄位填回來的跟實際花費是同一個數字，兩處不能各說各話", () => {
    const back = fromNet(fromNtd(3, RATE, false)!.net, RATE, false)!;
    expect(ntdToText(back.ntd)).toBe("3");
    expect(spend(back.ntd, RATE, false)!.ntd).toBe(3);
  });

  it("算不出來就讓欄位空著", () => {
    expect(ntdToText(Number.NaN)).toBe("");
  });
});

describe("楓幣的寫法", () => {
  it("0 就是 0萬", () => {
    expect(formatMeso(0)).toBe("0萬");
  });

  it("不到一億只寫萬，帶千分位", () => {
    expect(formatMeso(2660 * W)).toBe("2,660萬");
  });

  it("剛好一億只寫億", () => {
    expect(formatMeso(100_000_000)).toBe("1 億");
  });

  it("整數億不寫零頭", () => {
    expect(formatMeso(1400 * 100_000_000)).toBe("1,400 億");
  });

  it("有零頭就兩段都寫", () => {
    expect(formatMeso(1400 * 100_000_000 + 2660 * W)).toBe("1,400 億 2,660萬");
  });

  it("不到一億的零頭不會被捨進成一億", () => {
    expect(formatMeso(99_999_999)).toBe("9,999.99萬");
  });

  it("填回欄位的是楓幣本身，帶千分位", () => {
    expect(mesoToText(26_600_000)).toBe("26,600,000");
  });

  it("楓幣欄位的文字換成談價的級距", () => {
    expect(mesoTextInWords("26600000")).toBe("2,660萬");
    expect(mesoTextInWords("140000000000")).toBe("1,400 億");
  });

  it("欄位是空的或亂打的就不顯示", () => {
    expect(mesoTextInWords("")).toBe("");
    expect(mesoTextInWords("abc")).toBe("");
  });

  it("欄位帶著千分位也認得回來", () => {
    expect(parseAmount(mesoToText(26_600_000))).toBe(26_600_000);
  });
});
