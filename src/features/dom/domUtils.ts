// content script (itemSender.ts) 用の DOM・クランプユーティリティ。
// chrome.scripting.executeScript の func (MAIN world) からは参照できないため、
// MAIN world 内の同名ロジックとは意図的に分離している。詳細は src/popup/App.tsx の
// runItemSendInMainWorld 内のコメントを参照。
// popup (src/popup/App.tsx) はこのファイルを import せず、値を複製している。
// content script は classic script のため ESM import を使えず、popup が
// このファイルを import すると Vite が共有 chunk を作って content script 側に
// import 文が混入し、ビルドが壊れるため。
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
