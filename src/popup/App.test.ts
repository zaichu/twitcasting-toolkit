import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getMaxItemCountFromPoints, getNextItemCountFromInput } from "./App";

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

  it("does not use a browser confirm dialog before sending items", () => {
    const source = readFileSync(join(process.cwd(), "src/popup/App.tsx"), "utf8");

    expect(source).not.toContain("window.confirm");
  });
});
