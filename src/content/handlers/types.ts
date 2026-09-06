import type {
  CheckboxActionResult,
  CheckboxState,
  ExtensionMessage,
  ItemCandidateListResult,
  ItemSendResult
} from "../../extensionTypes";

// content script が popup に返す可能性のある応答の合併型。
export type ContentResponse =
  | CheckboxState
  | CheckboxActionResult
  | ItemCandidateListResult
  | ItemSendResult;

export type ContentSendResponse = (response: ContentResponse) => void;

// 各ハンドラは chrome.runtime.onMessage のリスナーと同じ規約に従う。
// sendResponse を非同期に呼ぶ場合は true を返す。
export type ContentMessageHandler = (
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: ContentSendResponse
) => boolean;

// ハンドラテーブルのキー。新しい message type の追加は、この合併型への
// 追加と MESSAGE_HANDLERS への1行追加で済む。
export type ContentMessageKey =
  | "checkbox:get-state"
  | "checkbox:run"
  | "checkbox:apply-rule"
  | "item-sender:list"
  | "item-sender:send";
