import type {
  ItemCandidate,
  ItemCandidateListResult,
  ItemSendRequest,
  ItemSendResult
} from "../../extensionTypes";

const MAX_ITEM_SEND_COUNT = 20;
const GIFT_ITEM_CALL_TIMEOUT_MS = 700;
const SEND_BUTTON_TIMEOUT_MS = 5000;
const SEND_BUTTON_POLL_MS = 100;

const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
};

export const normalizeText = (text: string): string => {
  return text.replace(/\s+/g, " ").trim();
};

export const clampItemSendCount = (count: number): number => {
  return Math.max(1, Math.min(count, MAX_ITEM_SEND_COUNT));
};

export const clampItemSendDelay = (delayMs: number): number => {
  return Math.max(300, Math.min(delayMs, 5000));
};

const isDisabledElement = (element: Element): boolean => {
  if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) {
    return element.disabled;
  }

  return element.getAttribute("aria-disabled") === "true";
};

const twitCastingItemSelector = [
  ".tw-item-list .tw-item-list-item",
  ".tw-item-list-item",
  'a[href^="javascript:giftItem("]'
].join(",");

type GiftItemCall = {
  userId: string;
  itemId: string;
  usePoint: boolean;
};

const getTwitCastingItemElements = (): HTMLElement[] => {
  return Array.from(document.querySelectorAll<HTMLElement>(twitCastingItemSelector)).filter(
    (element) => !isDisabledElement(element)
  );
};

const getTwitCastingItemLabel = (element: HTMLElement): string => {
  const name = normalizeText(
    element.querySelector<HTMLElement>(".tw-item-list-item-name")?.textContent ??
      element.querySelector<HTMLImageElement>(".tw-item-list-item-icon")?.alt ??
      ""
  );
  const amount = normalizeText(
    element.querySelector<HTMLElement>(".tw-item-list-item-amount")?.textContent ?? ""
  );

  if (!name) {
    return "";
  }

  return normalizeText([name, amount].filter(Boolean).join(" "));
};

export const getElementLabel = (element: HTMLElement): string => {
  const twitCastingItemLabel = getTwitCastingItemLabel(element);

  if (twitCastingItemLabel) {
    return twitCastingItemLabel;
  }

  return "";
};

const getAllItemCandidates = (): Array<ItemCandidate & { element: HTMLElement }> => {
  return getTwitCastingItemElements()
    .map((element, index) => ({
      index,
      element,
      label: getElementLabel(element)
    }))
    .filter((candidate) => candidate.label.length > 0);
};

export const listItemCandidates = (): ItemCandidateListResult => {
  const candidates = getAllItemCandidates()
    .slice(0, 80)
    .map(({ index, label }) => ({ index, label }));

  return {
    host: window.location.host,
    candidates
  };
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

export const parseGiftItemCall = (element: HTMLElement): GiftItemCall | undefined => {
  const href = element instanceof HTMLAnchorElement ? element.getAttribute("href") : null;

  if (!href) {
    return undefined;
  }

  const match = href.match(
    /giftItem\(\s*(['"])(.*?)\1\s*,\s*(['"])(.*?)\3\s*,\s*(true|false)\s*\)/
  );

  if (!match) {
    return undefined;
  }

  return {
    userId: match[2],
    itemId: match[4],
    usePoint: match[5] === "true"
  };
};

const callGiftItemInPage = (giftItemCall: GiftItemCall): Promise<boolean> => {
  const eventName = `twitcasting-toolkit:gift-item:${Date.now()}:${Math.random()}`;

  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      document.removeEventListener(eventName, handleResult);
      resolve(false);
    }, GIFT_ITEM_CALL_TIMEOUT_MS);

    const handleResult = (event: Event) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      document.removeEventListener(eventName, handleResult);
      const detail = (event as CustomEvent<{ ok: boolean }>).detail;
      resolve(Boolean(detail?.ok));
    };

    document.addEventListener(eventName, handleResult, { once: true });

    const script = document.createElement("script");
    script.textContent = `
      (() => {
        const eventName = ${JSON.stringify(eventName)};
        const args = ${JSON.stringify(giftItemCall)};
        try {
          if (typeof giftItem !== "function") {
            throw new Error("giftItem is not available");
          }
          giftItem(args.userId, args.itemId, args.usePoint);
          document.dispatchEvent(new CustomEvent(eventName, { detail: { ok: true } }));
        } catch (error) {
          document.dispatchEvent(new CustomEvent(eventName, {
            detail: { ok: false, message: String(error) }
          }));
        }
      })();
    `;
    document.documentElement.append(script);
    script.remove();
  });
};

const openGiftItemWindow = async (element: HTMLElement): Promise<boolean> => {
  const giftItemCall = parseGiftItemCall(element);

  if (giftItemCall && (await callGiftItemInPage(giftItemCall))) {
    return true;
  }

  pressElement(element);
  return true;
};

const getPointSendButton = (): HTMLElement | undefined => {
  const selectors = [
    '#tw-item-window-data .tw-item-send-post[data-sendable="true"] #messagelink',
    "#tw-item-window-data #gift_form #messagelink",
    "#gift_form #messagelink"
  ];

  return selectors
    .map((selector) => document.querySelector<HTMLElement>(selector))
    .find((element): element is HTMLElement => Boolean(element && !isDisabledElement(element)));
};

const waitForPointSendButton = async (): Promise<HTMLElement | undefined> => {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= SEND_BUTTON_TIMEOUT_MS) {
    const button = getPointSendButton();

    if (button) {
      return button;
    }

    await wait(SEND_BUTTON_POLL_MS);
  }

  return undefined;
};

export const findItemCandidates = (
  query: string
): Array<ItemCandidate & { element: HTMLElement }> => {
  const normalizedQuery = normalizeText(query).toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return getAllItemCandidates().filter((candidate) =>
    candidate.label.toLowerCase().includes(normalizedQuery)
  );
};

export const sendItems = async (request: ItemSendRequest): Promise<ItemSendResult> => {
  const count = clampItemSendCount(request.count);
  const delayMs = clampItemSendDelay(request.delayMs);
  const query = request.label ?? request.query ?? "";
  const candidates = getAllItemCandidates();
  const candidateByIndex =
    typeof request.candidateIndex === "number"
      ? candidates.find((item) => item.index === request.candidateIndex)
      : undefined;
  const candidate =
    candidateByIndex && (!request.label || candidateByIndex.label === request.label)
      ? candidateByIndex
      : candidates.find((item) => item.label === request.label) ?? findItemCandidates(query)[0];
  let sent = 0;

  if (!candidate) {
    return {
      host: window.location.host,
      query,
      requested: count,
      sent,
      stoppedReason: "候補が見つかりませんでした"
    };
  }

  for (let index = 0; index < count; index += 1) {
    if (!candidate.element.isConnected || isDisabledElement(candidate.element)) {
      return {
        host: window.location.host,
        query,
        requested: count,
        sent,
        stoppedReason: "候補が操作できない状態になりました"
      };
    }

    await openGiftItemWindow(candidate.element);

    const sendButton = await waitForPointSendButton();

    if (!sendButton) {
      return {
        host: window.location.host,
        query,
        requested: count,
        sent,
        stoppedReason: "ポイント送信ボタンが見つかりませんでした"
      };
    }

    pressElement(sendButton);
    sent += 1;

    if (index < count - 1) {
      await wait(delayMs);
    }
  }

  return {
    host: window.location.host,
    query,
    requested: count,
    sent
  };
};
