import { getLoggedInUserId } from "./features/itemSender/itemSender";
import { applyCheckboxRule } from "./content/handlers/checkbox";
import { POINT_RECOVERY_LOGGED_IN_USER_ID_KEY } from "./content/handlers/itemSender";
import { handleMessage } from "./content/handlers/router";

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
