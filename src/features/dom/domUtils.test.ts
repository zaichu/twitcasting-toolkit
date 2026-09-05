import { describe, expect, it } from "vitest";
import {
  clampItemSendCount,
  clampItemSendDelay,
  isDisabledElement,
  MAX_ITEM_SEND_COUNT,
  MAX_ITEM_SEND_DELAY_MS,
  MIN_ITEM_SEND_DELAY_MS
} from "./domUtils";

describe("domUtils", () => {
  it("clamps item send count to 1..MAX", () => {
    expect(clampItemSendCount(0)).toBe(1);
    expect(clampItemSendCount(1)).toBe(1);
    expect(clampItemSendCount(5)).toBe(5);
    expect(clampItemSendCount(MAX_ITEM_SEND_COUNT)).toBe(MAX_ITEM_SEND_COUNT);
    expect(clampItemSendCount(MAX_ITEM_SEND_COUNT + 10)).toBe(MAX_ITEM_SEND_COUNT);
  });

  it("clamps item send delay to MIN..MAX", () => {
    expect(clampItemSendDelay(MIN_ITEM_SEND_DELAY_MS - 1)).toBe(MIN_ITEM_SEND_DELAY_MS);
    expect(clampItemSendDelay(MIN_ITEM_SEND_DELAY_MS)).toBe(MIN_ITEM_SEND_DELAY_MS);
    expect(clampItemSendDelay(1000)).toBe(1000);
    expect(clampItemSendDelay(MAX_ITEM_SEND_DELAY_MS)).toBe(MAX_ITEM_SEND_DELAY_MS);
    expect(clampItemSendDelay(MAX_ITEM_SEND_DELAY_MS + 1)).toBe(MAX_ITEM_SEND_DELAY_MS);
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
