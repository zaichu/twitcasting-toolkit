import type {
  CheckboxAction,
  CheckboxActionResult,
  CheckboxRule,
  CheckboxState,
  ExtensionMessage,
  ItemCandidate,
  ItemPreviewResult,
  ItemSendRequest,
  ItemSendResult
} from "./extensionTypes";

const CONTENT_SETTINGS_KEY = "twitCastingToolkitSettings";
const MAX_ITEM_SEND_COUNT = 20;

const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
};

const normalizeText = (text: string): string => {
  return text.replace(/\s+/g, " ").trim();
};

const isDisabledElement = (element: Element): boolean => {
  if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) {
    return element.disabled;
  }

  return element.getAttribute("aria-disabled") === "true";
};

const getCheckboxes = (): HTMLInputElement[] => {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
};

const emitCheckboxEvents = (checkbox: HTMLInputElement) => {
  checkbox.dispatchEvent(new Event("input", { bubbles: true }));
  checkbox.dispatchEvent(new Event("change", { bubbles: true }));
};

const getCheckboxState = (): CheckboxState => {
  const checkboxes = getCheckboxes();
  const checked = checkboxes.filter((checkbox) => checkbox.checked).length;
  const disabled = checkboxes.filter((checkbox) => checkbox.disabled).length;

  return {
    url: window.location.href,
    host: window.location.host,
    total: checkboxes.length,
    checked,
    unchecked: checkboxes.length - checked,
    disabled
  };
};

const setCheckboxValue = (checkbox: HTMLInputElement, checked: boolean): boolean => {
  if (checkbox.disabled || checkbox.checked === checked) {
    return false;
  }

  checkbox.checked = checked;
  emitCheckboxEvents(checkbox);
  return true;
};

const runCheckboxAction = (action: CheckboxAction): CheckboxActionResult => {
  let changed = 0;

  getCheckboxes().forEach((checkbox) => {
    const nextValue = action === "invert" ? !checkbox.checked : action === "check";
    if (setCheckboxValue(checkbox, nextValue)) {
      changed += 1;
    }
  });

  return {
    ...getCheckboxState(),
    changed
  };
};

const isCheckboxRule = (value: unknown): value is CheckboxRule => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const rule = value as Partial<CheckboxRule>;
  return (
    typeof rule.autoApply === "boolean" &&
    (rule.action === "check" || rule.action === "uncheck")
  );
};

const getCurrentCheckboxRule = async (): Promise<CheckboxRule | undefined> => {
  const stored = await chrome.storage.sync.get(CONTENT_SETTINGS_KEY);
  const settings = stored[CONTENT_SETTINGS_KEY];

  if (!settings || typeof settings !== "object") {
    return undefined;
  }

  const checkboxRules = (settings as { checkboxRules?: unknown }).checkboxRules;

  if (!checkboxRules || typeof checkboxRules !== "object") {
    return undefined;
  }

  const rule = (checkboxRules as Record<string, unknown>)[window.location.host];
  return isCheckboxRule(rule) ? rule : undefined;
};

const applyCheckboxRule = async (): Promise<CheckboxActionResult> => {
  const rule = await getCurrentCheckboxRule();

  if (!rule?.autoApply) {
    return {
      ...getCheckboxState(),
      changed: 0
    };
  }

  return runCheckboxAction(rule.action);
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

const getElementLabel = (element: HTMLElement): string => {
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

const findItemCandidates = (query: string): Array<ItemCandidate & { element: HTMLElement }> => {
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

const previewItemCandidates = (query: string): ItemPreviewResult => {
  const candidates = findItemCandidates(query)
    .slice(0, 8)
    .map(({ index, label }) => ({ index, label }));

  return {
    host: window.location.host,
    query,
    candidates
  };
};

const sendItems = async (request: ItemSendRequest): Promise<ItemSendResult> => {
  const count = Math.max(1, Math.min(request.count, MAX_ITEM_SEND_COUNT));
  const delayMs = Math.max(300, Math.min(request.delayMs, 5000));
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

const handleMessage = (
  message: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (
    response: CheckboxState | CheckboxActionResult | ItemPreviewResult | ItemSendResult
  ) => void
) => {
  if (message.feature === "checkbox") {
    if (message.type === "get-state") {
      sendResponse(getCheckboxState());
      return false;
    }

    if (message.type === "run") {
      sendResponse(runCheckboxAction(message.action));
      return false;
    }

    applyCheckboxRule().then(sendResponse);
    return true;
  }

  if (message.type === "preview") {
    sendResponse(previewItemCandidates(message.query));
    return false;
  }

  sendItems(message.request).then(sendResponse);
  return true;
};

chrome.runtime.onMessage.addListener(handleMessage);

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      void applyCheckboxRule();
    },
    { once: true }
  );
} else {
  void applyCheckboxRule();
}
