import type { ExtensionMessage, ItemCandidateListResult } from "../../extensionTypes";
import { listItemCandidates, sendItems } from "../../features/itemSender/itemSender";
import type { ContentMessageHandler } from "./types";

// background.ts の値と同じ。content script は classic script として読み込まれ
// ESM import を使えないため値を複製する。
export const POINT_RECOVERY_LOGGED_IN_USER_ID_KEY = "twitCastingToolkitLoggedInUserId";
const POINT_RECOVERY_OBSERVED_MESSAGE_TYPE = "twitcasting-toolkit:point-recovery-observed";

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

type ItemSenderSendMessage = Extract<ExtensionMessage, { feature: "item-sender"; type: "send" }>;

export const handleItemSenderList: ContentMessageHandler = (_message, _sender, sendResponse) => {
  listItemCandidates().then((result) => {
    notifyBackgroundOfPointRecovery(result);
    sendResponse(result);
  });
  return true;
};

export const handleItemSenderSend: ContentMessageHandler = (message, _sender, sendResponse) => {
  sendItems((message as ItemSenderSendMessage).request).then(sendResponse);
  return true;
};
