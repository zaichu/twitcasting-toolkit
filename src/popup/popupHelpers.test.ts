import { describe, expect, it } from "vitest";
import {
  formatCheckboxStatus,
  getMaxItemCountFromPoints,
  getNextItemCountFromInput,
  getPointSummaryItems
} from "./popupHelpers";

describe("popup item sender helpers", () => {
  it("calculates the maximum send count from available points and item point cost", () => {
    expect(getMaxItemCountFromPoints(340, 50)).toBe(6);
    expect(getMaxItemCountFromPoints(2000, 50)).toBe(20);
    expect(getMaxItemCountFromPoints(undefined, 50)).toBeUndefined();
    expect(getMaxItemCountFromPoints(340, undefined)).toBeUndefined();
  });

  it("ポイント不足・不正な単価では最大送信回数を算出しない", () => {
    // 1回分にも満たない・単価が0以下は送信不可のため undefined
    expect(getMaxItemCountFromPoints(10, 50)).toBeUndefined();
    expect(getMaxItemCountFromPoints(0, 50)).toBeUndefined();
    expect(getMaxItemCountFromPoints(340, 0)).toBeUndefined();
    expect(getMaxItemCountFromPoints(340, -10)).toBeUndefined();
  });

  it("keeps item count input within the sendable range", () => {
    expect(getNextItemCountFromInput("6", 1)).toBe(6);
    expect(getNextItemCountFromInput("25", 1)).toBe(20);
    expect(getNextItemCountFromInput("0", 6)).toBe(1);
    expect(getNextItemCountFromInput("", 6)).toBe(6);
    expect(getNextItemCountFromInput("abc", 6)).toBe(6);
  });

  it("負数・小数は切り捨てて下限1に丸める", () => {
    expect(getNextItemCountFromInput("-3", 6)).toBe(1);
    expect(getNextItemCountFromInput("2.9", 6)).toBe(2);
  });

  it("formats owned and paid point details for the item sender", () => {
    expect(
      getPointSummaryItems(
        {
          availablePoints: 32,
          ownedPoints: 2,
          paidPoints: 0
        },
        32,
        50
      )
    ).toEqual([
      { label: "所有", value: "2 pt" },
      { label: "有料", value: "0 pt" },
      { label: "消費", value: "50 pt/回" }
    ]);
  });

  it("falls back to available points when owned points are unknown", () => {
    expect(getPointSummaryItems(undefined, 32, undefined)).toEqual([
      { label: "利用可能", value: "32 pt" },
      { label: "有料", value: "不明" },
      { label: "消費", value: "-" }
    ]);

    expect(getPointSummaryItems({ availablePoints: 32 }, undefined, undefined)).toEqual([
      { label: "利用可能", value: "32 pt" },
      { label: "有料", value: "不明" },
      { label: "消費", value: "-" }
    ]);
  });
});

describe("formatCheckboxStatus", () => {
  it("状態が無いときは対象ページを開く案内を返す", () => {
    expect(formatCheckboxStatus(undefined)).toBe("TwitCasting のページを開いてください");
  });

  it("取得状態では選択中件数を返す", () => {
    expect(
      formatCheckboxStatus({
        url: "https://twitcasting.tv/foo",
        host: "twitcasting.tv",
        total: 3,
        checked: 1,
        unchecked: 2,
        disabled: 0
      })
    ).toBe("1 / 3 件選択中");
  });

  it("操作結果では変更件数を返す", () => {
    expect(
      formatCheckboxStatus({
        url: "https://twitcasting.tv/foo",
        host: "twitcasting.tv",
        total: 3,
        checked: 1,
        unchecked: 2,
        disabled: 0,
        changed: 2
      })
    ).toBe("2 件変更 / 1 件選択中");
  });
});
