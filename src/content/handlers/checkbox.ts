import type { CheckboxActionResult, CheckboxRule, ExtensionMessage } from "../../extensionTypes";
import { getCheckboxState, runCheckboxAction } from "../../features/checkbox/checkboxTools";
import { getCheckboxRule } from "../../storage";
import type { ContentMessageHandler } from "./types";

const getCurrentCheckboxRule = async (): Promise<CheckboxRule | undefined> => {
  return getCheckboxRule(window.location.host);
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
