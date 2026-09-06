import { handleCheckboxApplyRule, handleCheckboxGetState, handleCheckboxRun } from "./checkbox";
import { handleItemSenderList, handleItemSenderSend } from "./itemSender";
import type { ContentMessageHandler, ContentMessageKey } from "./types";

// `${feature}:${type}` が登録済みキーかを判定する型ガード。
// `in` による絞り込みのため `as` キャストは不要。
const isKnownMessageKey = (key: string): key is ContentMessageKey =>
  key in MESSAGE_HANDLERS;

// message type の追加は ExtensionMessage への追加とこのテーブルへの1行追加で済む。
// ContentMessageKey は ExtensionMessage から導出されるため不足は型で検出される。
export const MESSAGE_HANDLERS: Record<ContentMessageKey, ContentMessageHandler> = {
  "checkbox:get-state": handleCheckboxGetState,
  "checkbox:run": handleCheckboxRun,
  "checkbox:apply-rule": handleCheckboxApplyRule,
  "item-sender:list": handleItemSenderList,
  "item-sender:send": handleItemSenderSend
};

// chrome.runtime.onMessage に登録するリスナー。ディスパッチのみを行い、
// 各 message type の処理は MESSAGE_HANDLERS に委譲する。
// Handler Map に無い未知の type は何もせず false を返す。破壊的・取り消し不可な
// 操作(send/apply-rule)へのフォールバックは行わない(02-security.md 参照)。
export const handleMessage: ContentMessageHandler = (message, sender, sendResponse) => {
  const key = `${message.feature}:${message.type}`;

  if (!isKnownMessageKey(key)) {
    // メッセージ内容(ページ由来の値を含む可能性)を出さないよう固定文言のみ記録する。
    console.warn("[twitcasting-toolkit] unknown content message, ignoring");
    return false;
  }

  return MESSAGE_HANDLERS[key](message, sender, sendResponse);
};
