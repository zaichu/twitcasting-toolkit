import { useState, type Dispatch, type SetStateAction } from "react";
import type {
  CheckboxAction,
  CheckboxActionResult,
  CheckboxRule,
  CheckboxState,
  ExtensionSettings
} from "../../extensionTypes";
import { saveCheckboxRule } from "../../storage";
import { sendToTab } from "../popupChrome";
import type { ActiveTab } from "../popupHelpers";

type UseCheckboxOptions = {
  tab: ActiveTab | undefined;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | undefined>>;
};

export const useCheckbox = ({ tab, busy, setBusy, setError }: UseCheckboxOptions) => {
  const [checkboxState, setCheckboxState] = useState<CheckboxState | CheckboxActionResult>();
  const [checkboxRule, setCheckboxRule] = useState<CheckboxRule>({
    autoApply: false,
    action: "check"
  });

  const loadCheckboxState = async (activeTab: ActiveTab) => {
    try {
      const state = await sendToTab<CheckboxState>(activeTab.id, {
        feature: "checkbox",
        type: "get-state"
      });
      setCheckboxState(state);
    } catch {
      setCheckboxState(undefined);
      setError("このページでは操作できません。ページを再読み込みしてください。");
    }
  };

  const clearCheckboxState = () => {
    setCheckboxState(undefined);
  };

  const syncRuleFromSettings = (settings: ExtensionSettings, host: string) => {
    setCheckboxRule(settings.checkboxRules[host] ?? { autoApply: false, action: "check" });
  };

  const runCheckboxAction = async (action: CheckboxAction) => {
    if (!tab) {
      return;
    }

    setBusy(true);
    setError(undefined);

    try {
      const result = await sendToTab<CheckboxActionResult>(tab.id, {
        feature: "checkbox",
        type: "run",
        action
      });
      setCheckboxState(result);
    } catch {
      setError("チェックボックス操作に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const updateCheckboxRule = async (nextRule: CheckboxRule) => {
    if (!tab) {
      return;
    }

    setCheckboxRule(nextRule);
    await saveCheckboxRule(tab.host, nextRule);

    if (nextRule.autoApply) {
      try {
        const result = await sendToTab<CheckboxActionResult>(tab.id, {
          feature: "checkbox",
          type: "apply-rule"
        });
        setCheckboxState(result);
      } catch {
        setError("自動適用の保存後、現在ページへの反映に失敗しました。");
      }
    }
  };

  return {
    checkboxState,
    checkboxRule,
    checkboxDisabled: !tab || busy,
    loadCheckboxState,
    clearCheckboxState,
    syncRuleFromSettings,
    runCheckboxAction,
    updateCheckboxRule
  };
};
