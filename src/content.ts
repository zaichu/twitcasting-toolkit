import type {
  CheckboxActionResult,
  CheckboxRule,
  CheckboxState,
  ExtensionMessage,
  ItemCandidateListResult,
  ItemSendResult
} from "./extensionTypes";
import { getCheckboxState, runCheckboxAction } from "./features/checkbox/checkboxTools";
import { listItemCandidates, sendItems } from "./features/itemSender/itemSender";

const CONTENT_SETTINGS_KEY = "twitCastingToolkitSettings";

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

const handleMessage = (
  message: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (
    response: CheckboxState | CheckboxActionResult | ItemCandidateListResult | ItemSendResult
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

  if (message.type === "list") {
    sendResponse(listItemCandidates());
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
