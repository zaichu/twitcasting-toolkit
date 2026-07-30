import { describe, expect, it } from "vitest";
import { getMaxItemCountFromPoints } from "./App";

describe("popup item sender helpers", () => {
  it("calculates the maximum send count from available points and item point cost", () => {
    expect(getMaxItemCountFromPoints(340, 50)).toBe(6);
    expect(getMaxItemCountFromPoints(2000, 50)).toBe(20);
    expect(getMaxItemCountFromPoints(undefined, 50)).toBeUndefined();
    expect(getMaxItemCountFromPoints(340, undefined)).toBeUndefined();
  });
});
