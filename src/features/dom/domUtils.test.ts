import { describe, expect, it } from "vitest";
import {
  clampItemSendCount,
  isDisabledElement,
  MAX_ITEM_SEND_COUNT
} from "./domUtils";

describe("domUtils", () => {
  it("clamps item send count to 1..MAX", () => {
    expect(clampItemSendCount(0)).toBe(1);
    expect(clampItemSendCount(1)).toBe(1);
    expect(clampItemSendCount(5)).toBe(5);
    expect(clampItemSendCount(MAX_ITEM_SEND_COUNT)).toBe(MAX_ITEM_SEND_COUNT);
    expect(clampItemSendCount(MAX_ITEM_SEND_COUNT + 10)).toBe(MAX_ITEM_SEND_COUNT);
  });

  it("detects disabled buttons and inputs", () => {
    const button = document.createElement("button");
    expect(isDisabledElement(button)).toBe(false);
    button.disabled = true;
    expect(isDisabledElement(button)).toBe(true);

    const input = document.createElement("input");
    expect(isDisabledElement(input)).toBe(false);
    input.disabled = true;
    expect(isDisabledElement(input)).toBe(true);
  });

  it("detects aria-disabled on generic elements", () => {
    const div = document.createElement("div");
    expect(isDisabledElement(div)).toBe(false);
    div.setAttribute("aria-disabled", "true");
    expect(isDisabledElement(div)).toBe(true);
    div.setAttribute("aria-disabled", "false");
    expect(isDisabledElement(div)).toBe(false);
  });
});
