import { handleCheckboxApplyRule, handleCheckboxGetState, handleCheckboxRun } from "./checkbox";
import { handleItemSenderList, handleItemSenderSend } from "./itemSender";
import type { ContentMessageHandler, ContentMessageKey } from "./types";

// message type の追加はこのテーブルへの1行追加(と ContentMessageKey への追加)で済む。
export const MESSAGE_HANDLERS: Record<ContentMessageKey, ContentMessageHandler> = {
  "checkbox:get-state": handleCheckboxGetState,
  "checkbox:run": handleCheckboxRun,
  "checkbox:apply-rule": handleCheckboxApplyRule,
  "item-sender:list": handleItemSenderList,
  "item-sender:send": handleItemSenderSend
};

// chrome.runtime.onMessage に登録するリスナー。ディスパッチのみを行い、
// 各 message type の処理は MESSAGE_HANDLERS に委譲する。
// 未知の type は従来のフォールスルーと同じ既定ハンドラに流し、
// 未知の feature は応答せず false を返す(いずれも従来通り)。
export const handleMessage: ContentMessageHandler = (message, sender, sendResponse) => {
  const handler = MESSAGE_HANDLERS[`${message.feature}:${message.type}` as ContentMessageKey];

  if (handler !== undefined) {
    return handler(message, sender, sendResponse);
  }

  if (message.feature === "checkbox") {
    return handleCheckboxApplyRule(message, sender, sendResponse);
  }

  if (message.feature === "item-sender") {
    return handleItemSenderSend(message, sender, sendResponse);
  }

  return false;
};
