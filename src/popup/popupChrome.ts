import type { ExtensionMessage } from "../extensionTypes";
import type { ActiveTab } from "./popupHelpers";

const twitCastingUrlPattern = /^https:\/\/([^.]+\.)?twitcasting\.tv\//;

const DEFAULT_ACTION_TITLE = "TwitCasting Toolkit";

// popup を開いた = 回復通知に気づいたとみなし、ツールバーバッジと action titleを
// 既定状態に戻す。一方のaction APIがrejectしても他方の実行や
// 未処理Promise rejectionの発生を妨げないよう、Promise.allSettledでまとめる。
export const resetRecoveryIndicator = async (): Promise<void> => {
  const results = await Promise.allSettled([
    chrome.action.setBadgeText({ text: "" }),
    chrome.action.setTitle({
      title: chrome.runtime.getManifest().action?.default_title ?? DEFAULT_ACTION_TITLE
    })
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[TwitCasting Toolkit] 回復通知インジケーターのリセットに失敗しました", result.reason);
    }
  }
};

export const getActiveTab = async (): Promise<ActiveTab | undefined> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url || !twitCastingUrlPattern.test(tab.url)) {
    return undefined;
  }

  return {
    id: tab.id,
    url: tab.url,
    host: new URL(tab.url).host
  };
};

export const sendToTab = async <TResponse,>(
  tabId: number,
  message: ExtensionMessage
): Promise<TResponse> => {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["assets/content.js"]
    });

    return chrome.tabs.sendMessage(tabId, message);
  }
};
