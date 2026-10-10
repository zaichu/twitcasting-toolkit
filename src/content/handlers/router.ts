import { handleCheckboxApplyRule, handleCheckboxGetState, handleCheckboxRun } from "./checkbox";
import { handleItemSenderList } from "./itemSender";
import type { ContentMessageHandler } from "./types";

// chrome.runtime.onMessage に登録するリスナー。実行時の入力は型で保証されない
// ため、feature:type の組み合わせが登録済みのものだけをハンドラに委譲する。
// 未知の組み合わせは何もせず false を返す。破壊的・取り消し不可な
// 操作(send/apply-rule)へのフォールバックは行わない(02-security.md 参照)。
// 各 default では message が never に絞られるため、ExtensionMessage や
// 分岐の追加漏れはコンパイルエラーになる。
export const handleMessage: ContentMessageHandler = (message, sender, sendResponse) => {
  switch (message.feature) {
    case "checkbox":
      switch (message.type) {
        case "get-state":
          return handleCheckboxGetState(message, sender, sendResponse);
        case "run":
          return handleCheckboxRun(message, sender, sendResponse);
        case "apply-rule":
          return handleCheckboxApplyRule(message, sender, sendResponse);
        default:
          message satisfies never;
      }
      break;
    case "item-sender":
      switch (message.type) {
        case "list":
          return handleItemSenderList(message, sender, sendResponse);
        default:
          message satisfies never;
      }
      break;
    default:
      message satisfies never;
  }

  // メッセージ内容(ページ由来の値を含む可能性)を出さないよう固定文言のみ記録する。
  console.warn("[twitcasting-toolkit] unknown content message, ignoring");
  return false;
};
