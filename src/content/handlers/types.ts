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

// ハンドラテーブルのキー。ExtensionMessage の各バリアントから導出するため、
// 新しい message type の追加時は MESSAGE_HANDLERS への1行追加が型で強制される
// (不足があれば Record<ContentMessageKey, ...> の代入時にコンパイルエラーになる)。
type MessageKeyOf<M extends ExtensionMessage> =
  M extends ExtensionMessage ? `${M["feature"]}:${M["type"]}` : never;

export type ContentMessageKey = MessageKeyOf<ExtensionMessage>;
