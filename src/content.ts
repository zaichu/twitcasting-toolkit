import { getLoggedInUserId } from "./features/itemSender/itemSender";
import { applyCheckboxRule } from "./content/handlers/checkbox";
import { handleMessage } from "./content/handlers/router";
import { getStoredLoggedInUserId, saveLoggedInUserId } from "./storage";

const saveLoggedInUserIdIfPresent = async (): Promise<void> => {
  const userId = getLoggedInUserId();

  if (!userId) {
    return;
  }

  if ((await getStoredLoggedInUserId()) === userId) {
    return;
  }

  await saveLoggedInUserId(userId);
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
