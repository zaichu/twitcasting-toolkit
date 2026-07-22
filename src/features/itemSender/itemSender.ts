import type {
  ItemCandidate,
  ItemPreviewResult,
  ItemSendRequest,
  ItemSendResult
} from "../../extensionTypes";

const MAX_ITEM_SEND_COUNT = 20;

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

const getInteractiveElements = (): HTMLElement[] => {
  const selector = [
    "button",
    "a[href]",
    '[role="button"]',
    'input[type="button"]',
    'input[type="submit"]'
  ].join(",");

  return Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
    (element) => !isDisabledElement(element)
  );
};

export const getElementLabel = (element: HTMLElement): string => {
  if (element instanceof HTMLInputElement) {
    return normalizeText(
      [element.value, element.getAttribute("aria-label"), element.title].filter(Boolean).join(" ")
    );
  }

  return normalizeText(
    [
      element.textContent ?? "",
      element.getAttribute("aria-label"),
      element.title,
      element.dataset.itemName,
      element.dataset.name
    ]
      .filter(Boolean)
      .join(" ")
  );
};

export const findItemCandidates = (
  query: string
): Array<ItemCandidate & { element: HTMLElement }> => {
  const normalizedQuery = normalizeText(query).toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return getInteractiveElements()
    .map((element, index) => ({
      index,
      element,
      label: getElementLabel(element)
    }))
    .filter((candidate) => candidate.label.toLowerCase().includes(normalizedQuery));
};

export const previewItemCandidates = (query: string): ItemPreviewResult => {
  const candidates = findItemCandidates(query)
    .slice(0, 8)
    .map(({ index, label }) => ({ index, label }));

  return {
    host: window.location.host,
    query,
    candidates
  };
};

export const sendItems = async (request: ItemSendRequest): Promise<ItemSendResult> => {
  const count = clampItemSendCount(request.count);
  const delayMs = clampItemSendDelay(request.delayMs);
  let sent = 0;

  for (let index = 0; index < count; index += 1) {
    const [candidate] = findItemCandidates(request.query);

    if (!candidate) {
      return {
        host: window.location.host,
        query: request.query,
        requested: count,
        sent,
        stoppedReason: "候補が見つかりませんでした"
      };
    }

    candidate.element.click();
    sent += 1;

    if (index < count - 1) {
      await wait(delayMs);
    }
  }

  return {
    host: window.location.host,
    query: request.query,
    requested: count,
    sent
  };
};
