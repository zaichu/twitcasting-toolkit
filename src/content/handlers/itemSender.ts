import type { ItemCandidateListResult } from "../../extensionTypes";
import {
  POINT_RECOVERY_FEATURE,
  POINT_RECOVERY_OBSERVED_TYPE
} from "../../features/pointRecovery/pointRecoveryNotifier";
import { listItemCandidates } from "../../features/itemSender/itemSender";
import type { ContentMessageHandler } from "./types";

// popup 操作でポイント情報が取得できたタイミングで、その内容を background の
// スナップショットにも反映させる。background のポイント状態確認は定期実行が
// 基本のため、これが無いと popup を使うだけでは回復待ち検知が始まらない。
const notifyBackgroundOfPointRecovery = (result: ItemCandidateListResult): void => {
  const pointRecovery = result.pointStatus?.pointRecovery;

  chrome.runtime
    .sendMessage({
      feature: POINT_RECOVERY_FEATURE,
      type: POINT_RECOVERY_OBSERVED_TYPE,
      snapshot: {
        availablePoints: result.pointStatus?.availablePoints,
        hasPendingRecovery: pointRecovery !== undefined,
        remainingText: pointRecovery?.remainingText
      }
    })
    .catch(() => {
      // background が起動していない等の失敗は無視する(次回の観測に任せる)
    });
};

export const handleItemSenderList: ContentMessageHandler = (_message, _sender, sendResponse) => {
  listItemCandidates().then((result) => {
    notifyBackgroundOfPointRecovery(result);
    sendResponse(result);
  });
  return true;
};
