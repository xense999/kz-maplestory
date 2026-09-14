import { describe, expect, it } from "vitest";
import {
  formatMeso,
  formatRaw,
  fromNet,
  fromNtd,
  roundUpSuggestion,
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

describe("湊整建議", () => {
  it("精確值不是整數時，建議進位到整數台幣並算出多拿多少", () => {
    const d = fromNet(5000 * W, RATE, false)!;
    const s = roundUpSuggestion(d.ntd, RATE, false)!;
    expect(s.ntd).toBe(2);
    // 2 台幣的實收 5320W，比原本的 5000W 多 320W
    expect(s.extra).toBeCloseTo(320 * W, 2);
  });

  it("精確值本來就是整數時不建議", () => {
    const d = fromNtd(3, RATE, false)!;
    const back = fromNet(d.net, RATE, false)!;
    expect(roundUpSuggestion(back.ntd, RATE, false)).toBeNull();
  });

  it("算不出來時不建議", () => {
    expect(roundUpSuggestion(1.5, 0, false)).toBeNull();
    expect(roundUpSuggestion(Number.NaN, RATE, false)).toBeNull();
  });
});

describe("楓幣的寫法", () => {
  it("0 就是 0W", () => {
    expect(formatMeso(0)).toBe("0W");
  });

  it("不到一億只寫 W，帶千分位", () => {
    expect(formatMeso(2660 * W)).toBe("2,660W");
  });

  it("剛好一億只寫億", () => {
    expect(formatMeso(100_000_000)).toBe("1 億");
  });

  it("整數億不寫零頭", () => {
    expect(formatMeso(1400 * 100_000_000)).toBe("1,400 億");
  });

  it("有零頭就兩段都寫", () => {
    expect(formatMeso(1400 * 100_000_000 + 2660 * W)).toBe("1,400 億 2,660W");
  });

  it("不到一億的零頭不會被捨進成一億", () => {
    expect(formatMeso(99_999_999)).toBe("9,999.99W");
  });

  it("原始數字帶千分位", () => {
    expect(formatRaw(26_600_000)).toBe("26,600,000");
  });
});
