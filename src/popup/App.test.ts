import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getMaxItemCountFromPoints,
  getNextItemCountFromInput,
  getPointSummaryItems
} from "./App";

describe("popup item sender helpers", () => {
  it("calculates the maximum send count from available points and item point cost", () => {
    expect(getMaxItemCountFromPoints(340, 50)).toBe(6);
    expect(getMaxItemCountFromPoints(2000, 50)).toBe(20);
    expect(getMaxItemCountFromPoints(undefined, 50)).toBeUndefined();
    expect(getMaxItemCountFromPoints(340, undefined)).toBeUndefined();
  });

  it("keeps item count input within the sendable range", () => {
    expect(getNextItemCountFromInput("6", 1)).toBe(6);
    expect(getNextItemCountFromInput("25", 1)).toBe(20);
    expect(getNextItemCountFromInput("0", 6)).toBe(1);
    expect(getNextItemCountFromInput("", 6)).toBe(6);
    expect(getNextItemCountFromInput("abc", 6)).toBe(6);
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

  it("does not use a browser confirm dialog before sending items", () => {
    const source = readFileSync(join(process.cwd(), "src/popup/App.tsx"), "utf8");

    expect(source).not.toContain("window.confirm");
  });
});
