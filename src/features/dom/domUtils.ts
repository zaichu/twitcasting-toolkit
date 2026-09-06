// アイテム送信用の DOM・クランプユーティリティ。popup / content 双方から import する
// 単一ソース。content script は独立 iife ビルドのため共有してもビルドは壊れない。
// ただし chrome.scripting.executeScript の func (MAIN world) からは参照できないため、
// MAIN world 内の同名ロジックとは意図的に分離している。詳細は
// src/popup/mainWorldItemSend.ts の runItemSendInMainWorld 内のコメントを参照。
export const MAX_ITEM_SEND_COUNT = 20;
export const MIN_ITEM_SEND_DELAY_MS = 300;
export const MAX_ITEM_SEND_DELAY_MS = 5000;

export const clampItemSendCount = (count: number): number => {
  return Math.max(1, Math.min(count, MAX_ITEM_SEND_COUNT));
};

export const clampItemSendDelay = (delayMs: number): number => {
  return Math.max(MIN_ITEM_SEND_DELAY_MS, Math.min(delayMs, MAX_ITEM_SEND_DELAY_MS));
};

export const isDisabledElement = (element: Element): boolean => {
  if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) {
    return element.disabled;
  }

  return element.getAttribute("aria-disabled") === "true";
};
