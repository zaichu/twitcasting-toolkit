import type { CheckboxActionResult, ExtensionMessage } from "../../extensionTypes";
import { getCheckboxState, runCheckboxAction } from "../../features/checkbox/checkboxTools";
import { getCheckboxRule } from "../../storage";
import type { ContentMessageHandler } from "./types";

export const applyCheckboxRule = async (): Promise<CheckboxActionResult> => {
  const rule = await getCheckboxRule(window.location.host);

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
