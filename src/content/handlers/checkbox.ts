import type { CheckboxActionResult, CheckboxRule, ExtensionMessage } from "../../extensionTypes";
import { getCheckboxState, runCheckboxAction } from "../../features/checkbox/checkboxTools";
import type { ContentMessageHandler } from "./types";

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

export const applyCheckboxRule = async (): Promise<CheckboxActionResult> => {
  const rule = await getCurrentCheckboxRule();

  if (!rule?.autoApply) {
    return {
      ...getCheckboxState(),
      changed: 0
    };
  }

  return runCheckboxAction(rule.action);
};

type CheckboxRunMessage = Extract<ExtensionMessage, { feature: "checkbox"; type: "run" }>;

export const handleCheckboxGetState: ContentMessageHandler = (_message, _sender, sendResponse) => {
  sendResponse(getCheckboxState());
  return false;
};

export const handleCheckboxRun: ContentMessageHandler = (message, _sender, sendResponse) => {
  sendResponse(runCheckboxAction((message as CheckboxRunMessage).action));
  return false;
};

export const handleCheckboxApplyRule: ContentMessageHandler = (_message, _sender, sendResponse) => {
  applyCheckboxRule().then(sendResponse);
  return true;
};
