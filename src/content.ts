import type {
  CheckboxActionResult,
  CheckboxRule,
  CheckboxState,
  ExtensionMessage,
  ItemCandidateListResult,
  ItemSendResult
} from "./extensionTypes";
import { getCheckboxState, runCheckboxAction } from "./features/checkbox/checkboxTools";
import { getLoggedInUserId, listItemCandidates, sendItems } from "./features/itemSender/itemSender";

const CONTENT_SETTINGS_KEY = "twitCastingToolkitSettings";
// background.ts の値と同じ。content script は classic script として読み込まれ
// ESM import を使えないため値を複製する。
const POINT_RECOVERY_LOGGED_IN_USER_ID_KEY = "twitCastingToolkitLoggedInUserId";
const POINT_RECOVERY_OBSERVED_MESSAGE_TYPE = "twitcasting-toolkit:point-recovery-observed";

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

const saveLoggedInUserIdIfPresent = async (): Promise<void> => {
  const userId = getLoggedInUserId();

  if (!userId) {
    return;
  }

  const stored = await chrome.storage.local.get(POINT_RECOVERY_LOGGED_IN_USER_ID_KEY);

  if (stored[POINT_RECOVERY_LOGGED_IN_USER_ID_KEY] === userId) {
    return;
  }

  await chrome.storage.local.set({ [POINT_RECOVERY_LOGGED_IN_USER_ID_KEY]: userId });
};

// popup 操作でポイント情報が取得できたタイミングで、その内容を background の
// スナップショットにも反映させる。background は 30 分間隔でしかポイント状態を
// 確認しないため、これが無いと popup を使うだけでは回復待ち検知が始まらない。
const notifyBackgroundOfPointRecovery = (result: ItemCandidateListResult): void => {
  const pointRecovery = result.pointStatus?.pointRecovery ?? result.pointRecovery;
  const availablePoints = result.pointStatus?.availablePoints ?? result.availablePoints;

  chrome.runtime
    .sendMessage({
      __type: POINT_RECOVERY_OBSERVED_MESSAGE_TYPE,
      snapshot: {
        availablePoints,
        hasPendingRecovery: pointRecovery !== undefined,
        remainingText: pointRecovery?.remainingText
      }
    })
    .catch(() => {
      // background が起動していない等の失敗は無視する(次回の観測に任せる)
    });
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
  if (message.feature !== "checkbox" && message.feature !== "item-sender") {
    return false;
  }

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
    listItemCandidates().then((result) => {
      notifyBackgroundOfPointRecovery(result);
      sendResponse(result);
    });
    return true;
  }

  sendItems(message.request).then(sendResponse);
  return true;
};

chrome.runtime.onMessage.addListener(handleMessage);

const runOnLoad = (): void => {
  void applyCheckboxRule();
  void saveLoggedInUserIdIfPresent();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", runOnLoad, { once: true });
} else {
  runOnLoad();
}
