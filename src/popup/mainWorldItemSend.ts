import type { ItemSendRequest, ItemSendResult } from "../extensionTypes";

export const runItemSendInMainWorld = async (
  tabId: number,
  request: ItemSendRequest,
  host: string
): Promise<ItemSendResult> => {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [request, host],
    func: async (sendRequest: ItemSendRequest, pageHost: string): Promise<ItemSendResult> => {
      // NOTE: この func は MAIN world にシリアライズ注入されるため、外部モジュール
      // (domUtils.ts 等) を import 参照できない。以下の DOM 操作関数は意図的に
      // func 内に残している。count / delayMs は呼び出し側 (sendItem) で事前に
      // クランプ済みの前提のため、ここでの clamp 再定義は不要。
      const sendButtonTimeoutMs = 10000;
      const sendButtonPollMs = 100;
      const insufficientPointsMessage = "必要なポイントが不足しています。";

      type GiftItemWindow = Window & {
        giftItem?: (userId: string, itemId?: string, usePoint?: boolean) => unknown;
      };

      const wait = (ms: number): Promise<void> => {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
      };

      const isDisabledElement = (element: Element): boolean => {
        if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) {
          return element.disabled;
        }

        return element.getAttribute("aria-disabled") === "true";
      };

      const isVisibleElement = (element: HTMLElement): boolean => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      };

      const pressElement = (element: HTMLElement) => {
        element.scrollIntoView?.({ block: "center", inline: "center" });
        element.focus({ preventScroll: true });

        const pointerOptions = {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "mouse"
        };
        const mouseOptions = {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1
        };
        const PointerEventConstructor = globalThis.PointerEvent ?? MouseEvent;

        element.dispatchEvent(new PointerEventConstructor("pointerdown", pointerOptions));
        element.dispatchEvent(new MouseEvent("mousedown", mouseOptions));
        element.dispatchEvent(new PointerEventConstructor("pointerup", pointerOptions));
        element.dispatchEvent(new MouseEvent("mouseup", mouseOptions));
        element.click();
      };

      const getPointSendButton = (): HTMLElement | undefined => {
        const selectors = [
          '#tw-item-window-data .tw-item-send-post[data-sendable="true"] #messagelink',
          "#tw-item-window-data #gift_form #messagelink",
          "#gift_form #messagelink"
        ];

        return selectors
          .map((selector) => document.querySelector<HTMLElement>(selector))
          .find(
            (element): element is HTMLElement =>
              Boolean(element && !isDisabledElement(element) && isVisibleElement(element))
          );
      };

      const hasInsufficientPointsMessage = (): boolean => {
        const selectors = ["#tw-item-window-data", ".tw-snackbar"];

        return selectors.some((selector) => {
          const element = document.querySelector<HTMLElement>(selector);

          return Boolean(element && element.textContent?.includes(insufficientPointsMessage));
        });
      };

      const waitForSendReadyState = async (): Promise<
        | {
            type: "send-button";
            button: HTMLElement;
          }
        | {
            type: "insufficient-points";
          }
        | {
            type: "timeout";
          }
      > => {
        const startedAt = Date.now();

        while (Date.now() - startedAt <= sendButtonTimeoutMs) {
          if (hasInsufficientPointsMessage()) {
            return { type: "insufficient-points" };
          }

          const button = getPointSendButton();

          if (button) {
            return { type: "send-button", button };
          }

          await wait(sendButtonPollMs);
        }

        return { type: "timeout" };
      };

      const findItemAnchor = (): HTMLElement | undefined => {
        if (!sendRequest.itemId) {
          return undefined;
        }

        const escapedItemId = sendRequest.itemId.replace(/["\\]/g, "\\$&");
        const selectors = [
          `a[href*="'${escapedItemId}'"][href*="giftItem("]`,
          `a[href*="\\"${escapedItemId}\\""][href*="giftItem("]`
        ];

        return selectors
          .map((selector) => document.querySelector<HTMLElement>(selector))
          .find((element): element is HTMLElement =>
            Boolean(element && !isDisabledElement(element))
          );
      };

      const openGiftWindow = async (): Promise<boolean> => {
        if (sendRequest.userId && sendRequest.itemId) {
          const giftItem = (window as GiftItemWindow).giftItem;

          if (typeof giftItem === "function") {
            giftItem(sendRequest.userId, sendRequest.itemId, true);
            return true;
          }
        }

        const itemAnchor = findItemAnchor();

        if (itemAnchor) {
          pressElement(itemAnchor);
          return true;
        }

        return false;
      };

      // sendItem 側で clampItemSendCount / clampItemSendDelay 済みの値を前提とする。
      const count = sendRequest.count;
      const delayMs = sendRequest.delayMs;
      const query = sendRequest.label ?? sendRequest.query ?? sendRequest.itemId ?? "";
      let sent = 0;

      for (let index = 0; index < count; index += 1) {
        const opened = await openGiftWindow();

        if (!opened) {
          return {
            host: pageHost,
            query,
            requested: count,
            sent,
            stoppedReason: "giftItem が見つからず、アイテム送信画面を開けませんでした"
          };
        }

        const sendReadyState = await waitForSendReadyState();

        if (sendReadyState.type === "insufficient-points") {
          return {
            host: pageHost,
            query,
            requested: count,
            sent,
            stoppedReason: insufficientPointsMessage
          };
        }

        if (sendReadyState.type === "timeout") {
          return {
            host: pageHost,
            query,
            requested: count,
            sent,
            stoppedReason: "ポイント送信ボタンが表示されませんでした"
          };
        }

        pressElement(sendReadyState.button);
        sent += 1;

        if (index < count - 1) {
          await wait(delayMs);
        }
      }

      return {
        host: pageHost,
        query,
        requested: count,
        sent
      };
    }
  });

  if (!result?.result) {
    throw new Error("MAIN world のアイテム送信結果を取得できませんでした");
  }

  return result.result;
};
