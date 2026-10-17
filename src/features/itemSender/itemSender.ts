import type {
  ItemCandidate,
  ItemCandidateListResult,
  PointStatus
} from "../../extensionTypes";
import { isDisabledElement } from "../dom/domUtils";
import {
  normalizeText,
  parseAvailablePointsFromText,
  parsePaidPointsFromText,
  parsePointRecoveryFromText
} from "../point/pointText";

const ACCOUNT_POINT_STATUS_TIMEOUT_MS = 5000;

const twitCastingItemSelector = [
  ".tw-item-list .tw-item-list-item",
  ".tw-item-list-item",
  'a[href^="javascript:giftItem("]'
].join(",");

type GiftItemCall = {
  userId: string;
  itemId: string;
};

type EmbeddedItemBoxItem = {
  item_id?: unknown;
  name?: unknown;
  point?: unknown;
  image_url?: unknown;
};

type EmbeddedItemBoxData = {
  items?: EmbeddedItemBoxItem[];
  point?: unknown;
  available_point?: unknown;
};

const getTwitCastingItemElements = (root: ParentNode = document): HTMLElement[] => {
  return Array.from(root.querySelectorAll<HTMLElement>(twitCastingItemSelector)).filter(
    (element) => !isDisabledElement(element)
  );
};

export const getElementLabel = (element: HTMLElement): string => {
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

const INIT_ITEM_BOX_WEB_UI_CALL = "initItemBoxWebUI(";

type EmbeddedItemBoxCall = {
  data: EmbeddedItemBoxData;
  userId?: string;
};

// initItemBoxWebUI(...) 呼び出しから設定オブジェクトの JSON と第1引数の
// ユーザー ID を取り出す。見つからない・壊れている呼び出しは undefined を返す。
const readEmbeddedItemBoxCall = (
  scriptText: string,
  initIndex: number
): EmbeddedItemBoxCall | undefined => {
  const openParenIndex = scriptText.indexOf("(", initIndex);
  const firstQuoteOffset = scriptText.slice(openParenIndex + 1).search(/["']/);
  const userId =
    firstQuoteOffset >= 0
      ? readQuotedStringAt(scriptText, openParenIndex + 1 + firstQuoteOffset)
      : parsePageVariableUserId();
  const itemsKeyIndex = scriptText.indexOf('"items"', openParenIndex);
  const objectStartIndex = scriptText.lastIndexOf("{", itemsKeyIndex);

  if (itemsKeyIndex < 0 || objectStartIndex < openParenIndex) {
    return undefined;
  }

  const objectText = readBalancedObjectAt(scriptText, objectStartIndex);

  if (!objectText) {
    return undefined;
  }

  try {
    return { data: JSON.parse(objectText) as EmbeddedItemBoxData, userId };
  } catch {
    // 埋め込みデータの JSON 解析に失敗した場合は無視する
    return undefined;
  }
};

const readEmbeddedItemBoxCalls = (root: Document): EmbeddedItemBoxCall[] => {
  const calls: EmbeddedItemBoxCall[] = [];

  for (const script of Array.from(root.scripts)) {
    const scriptText = script.textContent ?? "";
    let searchFrom = 0;

    while (searchFrom < scriptText.length) {
      const initIndex = scriptText.indexOf(INIT_ITEM_BOX_WEB_UI_CALL, searchFrom);

      if (initIndex < 0) {
        break;
      }

      const call = readEmbeddedItemBoxCall(scriptText, initIndex);

      if (call) {
        calls.push(call);
      }

      searchFrom = initIndex + INIT_ITEM_BOX_WEB_UI_CALL.length;
    }
  }

  return calls;
};

const getAvailablePointsFromEmbeddedScripts = (root: Document = document): number | undefined => {
  for (const call of readEmbeddedItemBoxCalls(root)) {
    if (typeof call.data.available_point === "number") {
      return call.data.available_point;
    }
  }

  return undefined;
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
    itemId: match[4]
  };
};

const getDomItemCandidates = (root: ParentNode = document): ItemCandidate[] => {
  return getTwitCastingItemElements(root)
    .map((element, index) => {
      const giftItemCall = parseGiftItemCall(element);

      return {
        index,
        label: getElementLabel(element),
        userId: giftItemCall?.userId,
        itemId: giftItemCall?.itemId,
        point: getNumberFromText(
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

type AjaxItemListResult = {
  candidates: ItemCandidate[];
  pointStatus?: PointStatus;
};

const getNumberFromText = (text: string | undefined): number | undefined => {
  if (!text) {
    return undefined;
  }

  const match = normalizeText(text).replace(/,/g, "").match(/\d+/);
  const value = match ? Number(match[0]) : undefined;

  return value !== undefined && Number.isFinite(value) ? value : undefined;
};

const getPointStatusFromDocument = (root: ParentNode): PointStatus | undefined => {
  const container =
    root instanceof Document ? (root.body ?? root.documentElement) : (root as HTMLElement);
  const text = container?.textContent ?? "";
  const availablePoints = parseAvailablePointsFromText(text);
  const pointRecovery = parsePointRecoveryFromText(text);
  const pointRows = Array.from(
    root.querySelectorAll<HTMLElement>(".tw-point-having-props-display li")
  );
  const pointRow = pointRows.find((row) =>
    normalizeText(
      row.querySelector<HTMLElement>(".tw-point-having-props-display__name")?.textContent ??
        row.textContent ??
        ""
    ).includes("ポイント")
  );
  const ownedPoints = getNumberFromText(
    pointRow?.querySelector<HTMLElement>(".tw-point-having-props-display__amount")?.textContent
  );
  const paidPointText =
    pointRow?.querySelector<HTMLElement>(".tw-point-having-props-display__desc")?.textContent ??
    "";
  const paidPoints = parsePaidPointsFromText(paidPointText);
  const pointStatus: PointStatus = {};

  if (availablePoints !== undefined) {
    pointStatus.availablePoints = availablePoints;
  }

  if (ownedPoints !== undefined) {
    pointStatus.ownedPoints = ownedPoints;
  }

  if (paidPoints !== undefined) {
    pointStatus.paidPoints = paidPoints;
  }

  if (pointRecovery) {
    pointStatus.pointRecovery = pointRecovery;
  }

  return Object.keys(pointStatus).length > 0 ? pointStatus : undefined;
};

export const getLoggedInUserId = (): string | undefined => {
  return document.querySelector<HTMLElement>(".tw-global-header[data-user-id]")?.dataset.userId;
};

const getAccountPointStatus = async (): Promise<PointStatus | undefined> => {
  const userId = getLoggedInUserId();

  if (!userId) {
    return undefined;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, ACCOUNT_POINT_STATUS_TIMEOUT_MS);

  try {
    const response = await fetch(`/${encodeURIComponent(userId)}/points`, {
      credentials: "include",
      signal: controller.signal
    });

    if (!response.ok) {
      return undefined;
    }

    const html = await response.text();
    const parsedDocument = new DOMParser().parseFromString(html, "text/html");

    return getPointStatusFromDocument(parsedDocument);
  } catch {
    return undefined;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const mergePointStatus = (...statuses: Array<PointStatus | undefined>): PointStatus | undefined => {
  const merged: PointStatus = {};

  for (const status of statuses) {
    if (!status) {
      continue;
    }

    merged.availablePoints ??= status.availablePoints;
    merged.ownedPoints ??= status.ownedPoints;
    merged.paidPoints ??= status.paidPoints;
    merged.pointRecovery ??= status.pointRecovery;
  }

  return Object.values(merged).some((value) => value !== undefined) ? merged : undefined;
};

const getAjaxItemListCandidates = async (): Promise<AjaxItemListResult> => {
  const userId = getTargetUserId();

  if (!userId) {
    return { candidates: [] };
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
      return { candidates: [] };
    }

    const html = await response.text();
    const parsedDocument = new DOMParser().parseFromString(html, "text/html");
    const parsedPointStatus = getPointStatusFromDocument(parsedDocument);
    const availablePoints =
      parsedPointStatus?.availablePoints ?? getAvailablePointsFromEmbeddedScripts(parsedDocument);
    const pointStatus = mergePointStatus(parsedPointStatus, { availablePoints });

    if (!html.includes("tw-item-list-item")) {
      return { candidates: [], pointStatus };
    }

    return {
      candidates: getDomItemCandidates(parsedDocument).map((candidate, index) => ({
        ...candidate,
        index
      })),
      pointStatus
    };
  } catch {
    return { candidates: [] };
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

const toItemCandidates = (data: EmbeddedItemBoxData, userId: string): ItemCandidate[] => {
  try {
    const items = Array.isArray(data.items) ? data.items : [];

    return items
      .map((item, index): ItemCandidate | undefined => {
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
      .filter((candidate): candidate is ItemCandidate => Boolean(candidate));
  } catch {
    return [];
  }
};

const getEmbeddedItemBoxCandidates = (): ItemCandidate[] => {
  const candidates: ItemCandidate[] = [];

  for (const call of readEmbeddedItemBoxCalls(document)) {
    if (call.userId) {
      candidates.push(...toItemCandidates(call.data, call.userId));
    }
  }

  return candidates.map((candidate, index) => ({ ...candidate, index }));
};

const getAllItemCandidates = (): ItemCandidate[] => {
  const domCandidates = getDomItemCandidates();

  return domCandidates.length > 0 ? domCandidates : getEmbeddedItemBoxCandidates();
};

export const listItemCandidates = async (): Promise<ItemCandidateListResult> => {
  const [ajaxResult, accountPointStatus] = await Promise.all([
    getAjaxItemListCandidates(),
    getAccountPointStatus()
  ]);
  const candidates = (
    ajaxResult.candidates.length > 0 ? ajaxResult.candidates : getAllItemCandidates()
  ).slice(0, 80);
  const fallbackPointsRoot: ParentNode =
    document.querySelector<HTMLElement>("#tw-item-window-data") ?? document;
  const documentPointStatus = getPointStatusFromDocument(fallbackPointsRoot);
  const availablePoints =
    ajaxResult.pointStatus?.availablePoints ??
    documentPointStatus?.availablePoints ??
    getAvailablePointsFromEmbeddedScripts();
  const pointStatus = mergePointStatus(
    { availablePoints },
    accountPointStatus,
    ajaxResult.pointStatus,
    documentPointStatus
  );

  return {
    candidates,
    pointStatus
  };
};
