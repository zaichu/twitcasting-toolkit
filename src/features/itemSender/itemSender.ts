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

type EmbeddedItemBoxItem = {
  item_id?: unknown;
  name?: unknown;
  point?: unknown;
  image_url?: unknown;
};

type EmbeddedItemBoxData = {
  items?: EmbeddedItemBoxItem[];
};

type ItemCandidateWithSource = ItemCandidate & {
  element?: HTMLElement;
};

const getTwitCastingItemElements = (root: ParentNode = document): HTMLElement[] => {
  return Array.from(root.querySelectorAll<HTMLElement>(twitCastingItemSelector)).filter(
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

const getPointFromText = (text: string): number | undefined => {
  const match = normalizeText(text).replace(/,/g, "").match(/\d+/);

  return match ? Number(match[0]) : undefined;
};

const toAbsoluteUrl = (url: string | undefined): string | undefined => {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return undefined;
  }
};

const getTwitCastingItemImageUrl = (element: HTMLElement): string | undefined => {
  return toAbsoluteUrl(
    element.querySelector<HTMLImageElement>(".tw-item-list-item-icon")?.getAttribute("src") ??
      element.querySelector<HTMLImageElement>("img")?.getAttribute("src") ??
      undefined
  );
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

const getDomItemCandidates = (root: ParentNode = document): ItemCandidateWithSource[] => {
  return getTwitCastingItemElements(root)
    .map((element, index) => {
      const giftItemCall = parseGiftItemCall(element);

      return {
        index,
        element,
        label: getElementLabel(element),
        userId: giftItemCall?.userId,
        itemId: giftItemCall?.itemId,
        point: getPointFromText(
          element.querySelector<HTMLElement>(".tw-item-list-item-amount")?.textContent ?? ""
        ),
        imageUrl: getTwitCastingItemImageUrl(element)
      };
    })
    .filter((candidate) => candidate.label.length > 0);
};

const parsePageVariableUserId = (): string | undefined => {
  const content = document
    .querySelector<HTMLMetaElement>('meta[name="tc-page-variables"]')
    ?.getAttribute("content");

  if (!content) {
    return undefined;
  }

  try {
    const data = JSON.parse(content) as { broadcaster_id?: unknown };

    return typeof data.broadcaster_id === "string" ? data.broadcaster_id : undefined;
  } catch {
    return undefined;
  }
};

const getTargetUserId = (): string | undefined => {
  return (
    parsePageVariableUserId() ??
    document.querySelector<HTMLElement>("#tw-item-window")?.dataset.targetUserId ??
    document.querySelector<HTMLElement>(".tw-user-header")?.dataset.userId ??
    document.querySelector<HTMLElement>(".tw-next-watch-list")?.dataset.userId
  );
};

const getAjaxItemListCandidates = async (): Promise<ItemCandidateWithSource[]> => {
  const userId = getTargetUserId();

  if (!userId) {
    return [];
  }

  const params = new URLSearchParams();
  params.set("c", "sendgift");
  params.set("tuser", userId);

  try {
    const response = await fetch(`/gearajax.php?${params.toString()}`, {
      credentials: "include",
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();

    if (!html.includes("tw-item-list-item")) {
      return [];
    }

    const parsedDocument = new DOMParser().parseFromString(html, "text/html");

    return getDomItemCandidates(parsedDocument).map((candidate, index) => ({
      ...candidate,
      index
    }));
  } catch {
    return [];
  }
};

const readQuotedStringAt = (source: string, startIndex: number): string | undefined => {
  const quote = source[startIndex];

  if (quote !== '"' && quote !== "'") {
    return undefined;
  }

  let escaped = false;
  let value = "";

  for (let index = startIndex + 1; index < source.length; index += 1) {
    const character = source[index];

    if (escaped) {
      value += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === quote) {
      return value;
    }

    value += character;
  }

  return undefined;
};

const readBalancedObjectAt = (source: string, startIndex: number): string | undefined => {
  if (source[startIndex] !== "{") {
    return undefined;
  }

  let depth = 0;
  let quote: string | undefined;
  let escaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === quote) {
        quote = undefined;
      }

      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  return undefined;
};

const parseEmbeddedItemBoxCandidatesFromScript = (
  scriptText: string,
  initIndex: number
): ItemCandidateWithSource[] => {
  const openParenIndex = scriptText.indexOf("(", initIndex);
  const firstQuoteOffset = scriptText.slice(openParenIndex + 1).search(/["']/);
  const userId =
    firstQuoteOffset >= 0
      ? readQuotedStringAt(scriptText, openParenIndex + 1 + firstQuoteOffset)
      : parsePageVariableUserId();
  const itemsKeyIndex = scriptText.indexOf('"items"', openParenIndex);
  const objectStartIndex = scriptText.lastIndexOf("{", itemsKeyIndex);

  if (!userId || itemsKeyIndex < 0 || objectStartIndex < openParenIndex) {
    return [];
  }

  const objectText = readBalancedObjectAt(scriptText, objectStartIndex);

  if (!objectText) {
    return [];
  }

  try {
    const data = JSON.parse(objectText) as EmbeddedItemBoxData;
    const items = Array.isArray(data.items) ? data.items : [];

    return items
      .map((item, index): ItemCandidateWithSource | undefined => {
        const itemId = typeof item.item_id === "string" ? item.item_id : undefined;
        const name = typeof item.name === "string" ? normalizeText(item.name) : "";
        const point = typeof item.point === "number" ? item.point : undefined;
        const imageUrl = typeof item.image_url === "string" ? toAbsoluteUrl(item.image_url) : undefined;

        if (!itemId || !name) {
          return undefined;
        }

        return {
          index,
          label: normalizeText([name, point].filter((value) => value !== undefined).join(" ")),
          userId,
          itemId,
          point,
          imageUrl
        };
      })
      .filter((candidate): candidate is ItemCandidateWithSource => Boolean(candidate));
  } catch {
    return [];
  }
};

const getEmbeddedItemBoxCandidates = (): ItemCandidateWithSource[] => {
  const candidates: ItemCandidateWithSource[] = [];

  for (const script of Array.from(document.scripts)) {
    const scriptText = script.textContent ?? "";
    let searchFrom = 0;

    while (searchFrom < scriptText.length) {
      const initIndex = scriptText.indexOf("initItemBoxWebUI(", searchFrom);

      if (initIndex < 0) {
        break;
      }

      candidates.push(...parseEmbeddedItemBoxCandidatesFromScript(scriptText, initIndex));
      searchFrom = initIndex + "initItemBoxWebUI(".length;
    }
  }

  return candidates.map((candidate, index) => ({ ...candidate, index }));
};

const getAllItemCandidates = (): ItemCandidateWithSource[] => {
  const domCandidates = getDomItemCandidates();

  return domCandidates.length > 0 ? domCandidates : getEmbeddedItemBoxCandidates();
};

export const listItemCandidates = async (): Promise<ItemCandidateListResult> => {
  const ajaxCandidates = await getAjaxItemListCandidates();
  const candidates = (ajaxCandidates.length > 0 ? ajaxCandidates : getAllItemCandidates())
    .slice(0, 80)
    .map(({ index, label, userId, itemId, point, imageUrl }) => ({
      index,
      label,
      userId,
      itemId,
      point,
      imageUrl
    }));

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

const openGiftItemWindow = async (candidate: ItemCandidateWithSource): Promise<boolean> => {
  const giftItemCall =
    candidate.userId && candidate.itemId
      ? { userId: candidate.userId, itemId: candidate.itemId, usePoint: true }
      : candidate.element
        ? parseGiftItemCall(candidate.element)
        : undefined;

  if (giftItemCall && (await callGiftItemInPage(giftItemCall))) {
    return true;
  }

  if (candidate.element) {
    pressElement(candidate.element);
    return true;
  }

  return false;
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
): ItemCandidateWithSource[] => {
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
  const candidateByItemId =
    request.userId && request.itemId
      ? candidates.find(
          (item) => item.userId === request.userId && item.itemId === request.itemId
        ) ?? {
          index: -1,
          label: request.label ?? request.itemId,
          userId: request.userId,
          itemId: request.itemId
        }
      : undefined;
  const candidateByIndex =
    typeof request.candidateIndex === "number"
      ? candidates.find((item) => item.index === request.candidateIndex)
      : undefined;
  const candidate =
    candidateByItemId ??
    (candidateByIndex && (!request.label || candidateByIndex.label === request.label)
      ? candidateByIndex
      : candidates.find((item) => item.label === request.label) ?? findItemCandidates(query)[0]);
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
    if (candidate.element && (!candidate.element.isConnected || isDisabledElement(candidate.element))) {
      return {
        host: window.location.host,
        query,
        requested: count,
        sent,
        stoppedReason: "候補が操作できない状態になりました"
      };
    }

    const opened = await openGiftItemWindow(candidate);

    if (!opened) {
      return {
        host: window.location.host,
        query,
        requested: count,
        sent,
        stoppedReason: "アイテム送信画面を開けませんでした"
      };
    }

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
