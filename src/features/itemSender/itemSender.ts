import type {
  ItemCandidate,
  ItemCandidateListResult,
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
  const imageLabels = Array.from(element.querySelectorAll<HTMLImageElement>("img"))
    .flatMap((image) => [image.alt, image.title, image.getAttribute("aria-label")])
    .filter(Boolean);
  const datasetLabels = Object.values(element.dataset).filter(Boolean);

  if (element instanceof HTMLInputElement) {
    return normalizeText(
      [
        element.value,
        element.getAttribute("aria-label"),
        element.title,
        ...imageLabels,
        ...datasetLabels
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  return normalizeText(
    [
      element.textContent ?? "",
      element.getAttribute("aria-label"),
      element.title,
      ...imageLabels,
      ...datasetLabels
    ]
      .filter(Boolean)
      .join(" ")
  );
};

const getAllItemCandidates = (): Array<ItemCandidate & { element: HTMLElement }> => {
  return getInteractiveElements()
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
  element.dispatchEvent(new MouseEvent("click", mouseOptions));
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

    pressElement(candidate.element);
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
