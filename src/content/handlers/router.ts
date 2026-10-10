import { handleCheckboxApplyRule, handleCheckboxGetState, handleCheckboxRun } from "./checkbox";
import { handleItemSenderList } from "./itemSender";
import type { ContentMessageHandler } from "./types";

// chrome.runtime.onMessage に登録するリスナー。message.type は全バリアントで
// 一意なので判別共用体として直接分岐し、各 message type の処理はハンドラに委譲する。
// 未知の type は何もせず false を返す。破壊的・取り消し不可な
// 操作(send/apply-rule)へのフォールバックは行わない(02-security.md 参照)。
export const handleMessage: ContentMessageHandler = (message, sender, sendResponse) => {
  switch (message.type) {
    case "get-state":
      return handleCheckboxGetState(message, sender, sendResponse);
    case "run":
      return handleCheckboxRun(message, sender, sendResponse);
    case "apply-rule":
      return handleCheckboxApplyRule(message, sender, sendResponse);
    case "list":
      return handleItemSenderList(message, sender, sendResponse);
    default:
      // ExtensionMessage の type と case が揃っていればここは never に絞られ、
      // 分岐の追加漏れはコンパイルエラーになる。
      message satisfies never;
      // メッセージ内容(ページ由来の値を含む可能性)を出さないよう固定文言のみ記録する。
      console.warn("[twitcasting-toolkit] unknown content message, ignoring");
      return false;
  }
};
