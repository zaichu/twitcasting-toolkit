import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CheckboxActionResult,
  CheckboxState,
  ExtensionMessage,
  ItemCandidateListResult,
  ItemSendResult
} from "../../extensionTypes";
import { getCheckboxState, runCheckboxAction } from "../../features/checkbox/checkboxTools";
import { listItemCandidates, sendItems } from "../../features/itemSender/itemSender";
import { MESSAGE_HANDLERS, handleMessage } from "./router";

vi.mock("../../features/checkbox/checkboxTools", () => ({
  getCheckboxState: vi.fn(),
  runCheckboxAction: vi.fn()
}));

vi.mock("../../features/itemSender/itemSender", () => ({
  getLoggedInUserId: vi.fn(),
  listItemCandidates: vi.fn(),
  sendItems: vi.fn()
}));

const chromeMock = {
  storage: {
    sync: {
      get: vi.fn()
    },
    local: {
      get: vi.fn(),
      set: vi.fn()
    }
  },
  runtime: {
    sendMessage: vi.fn()
  }
};

vi.stubGlobal("chrome", chromeMock);

const sender = {} as chrome.runtime.MessageSender;

const checkboxState: CheckboxState = {
  url: "https://twitcasting.tv/foo",
  host: "twitcasting.tv",
  total: 2,
  checked: 1,
  unchecked: 1,
  disabled: 0
};

const checkboxActionResult: CheckboxActionResult = { ...checkboxState, changed: 1 };

const listResult: ItemCandidateListResult = {
  host: "twitcasting.tv",
  candidates: [],
  availablePoints: 100
};

const sendResult: ItemSendResult = {
  host: "twitcasting.tv",
  query: "coin",
  requested: 1,
  sent: 1
};

describe("content router", () => {
  beforeEach(() => {
    chromeMock.storage.sync.get.mockReset().mockResolvedValue({});
    chromeMock.storage.local.get.mockReset().mockResolvedValue({});
    chromeMock.storage.local.set.mockReset().mockResolvedValue(undefined);
    chromeMock.runtime.sendMessage.mockReset().mockResolvedValue(undefined);
    vi.mocked(getCheckboxState).mockReset().mockReturnValue(checkboxState);
    vi.mocked(runCheckboxAction).mockReset().mockReturnValue(checkboxActionResult);
    vi.mocked(listItemCandidates).mockReset().mockResolvedValue(listResult);
    vi.mocked(sendItems).mockReset().mockResolvedValue(sendResult);
  });

  it("5つの message type がテーブルに登録されている", () => {
    expect(Object.keys(MESSAGE_HANDLERS).sort()).toEqual(
      [
        "checkbox:apply-rule",
        "checkbox:get-state",
        "checkbox:run",
        "item-sender:list",
        "item-sender:send"
      ].sort()
    );
  });

  it("checkbox:get-state を同期で応答し false を返す", () => {
    const sendResponse = vi.fn();
    const message: ExtensionMessage = { feature: "checkbox", type: "get-state" };

    expect(handleMessage(message, sender, sendResponse)).toBe(false);
    expect(getCheckboxState).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith(checkboxState);
  });

  it("checkbox:run を同期で応答し false を返す", () => {
    const sendResponse = vi.fn();
    const message: ExtensionMessage = { feature: "checkbox", type: "run", action: "check" };

    expect(handleMessage(message, sender, sendResponse)).toBe(false);
    expect(runCheckboxAction).toHaveBeenCalledWith("check");
    expect(sendResponse).toHaveBeenCalledWith(checkboxActionResult);
  });

  it("checkbox:apply-rule が autoApply ルールを実行し true を返す", async () => {
    chromeMock.storage.sync.get.mockResolvedValue({
      twitCastingToolkitSettings: {
        checkboxRules: { "twitcasting.tv": { autoApply: true, action: "check" } }
      }
    });
    const sendResponse = vi.fn();
    const message: ExtensionMessage = { feature: "checkbox", type: "apply-rule" };

    expect(handleMessage(message, sender, sendResponse)).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(checkboxActionResult));
    expect(runCheckboxAction).toHaveBeenCalledWith("check");
  });

  it("checkbox:apply-rule はルールが無い場合に状態をそのまま返し true を返す", async () => {
    const sendResponse = vi.fn();
    const message: ExtensionMessage = { feature: "checkbox", type: "apply-rule" };

    expect(handleMessage(message, sender, sendResponse)).toBe(true);
    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({ ...checkboxState, changed: 0 })
    );
    expect(runCheckboxAction).not.toHaveBeenCalled();
  });

  it("item-sender:list を非同期で応答し background へ通知して true を返す", async () => {
    const sendResponse = vi.fn();
    const message: ExtensionMessage = { feature: "item-sender", type: "list" };

    expect(handleMessage(message, sender, sendResponse)).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(listResult));
    expect(listItemCandidates).toHaveBeenCalledTimes(1);
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ __type: "twitcasting-toolkit:point-recovery-observed" })
    );
  });

  it("item-sender:send を非同期で応答し true を返す", async () => {
    const sendResponse = vi.fn();
    const request = { count: 1, delayMs: 300, label: "coin" };
    const message: ExtensionMessage = { feature: "item-sender", type: "send", request };

    expect(handleMessage(message, sender, sendResponse)).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(sendResult));
    expect(sendItems).toHaveBeenCalledWith(request);
  });

  it("未知の feature には応答せず false を返す", () => {
    const sendResponse = vi.fn();
    const message = { feature: "unknown", type: "unknown" } as unknown as ExtensionMessage;

    expect(handleMessage(message, sender, sendResponse)).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it("未知の checkbox type は apply-rule と同じく非同期で true を返す", async () => {
    const sendResponse = vi.fn();
    const message = { feature: "checkbox", type: "unknown" } as unknown as ExtensionMessage;

    expect(handleMessage(message, sender, sendResponse)).toBe(true);
    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({ ...checkboxState, changed: 0 })
    );
  });

  it("未知の item-sender type は send と同じく非同期で true を返す", async () => {
    const sendResponse = vi.fn();
    const message = { feature: "item-sender", type: "unknown" } as unknown as ExtensionMessage;

    expect(handleMessage(message, sender, sendResponse)).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(sendResult));
  });
});
