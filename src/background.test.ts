import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POINT_RECOVERY_SNAPSHOT_KEY, PointRecoverySnapshot } from "./features/pointRecovery/pointRecoveryNotifier";

// content.ts の POINT_RECOVERY_OBSERVED_MESSAGE_TYPE と同じ値。
const POINT_RECOVERY_OBSERVED_MESSAGE_TYPE = "twitcasting-toolkit:point-recovery-observed";

type ObservedMessage = {
  __type: typeof POINT_RECOVERY_OBSERVED_MESSAGE_TYPE;
  snapshot: PointRecoverySnapshot;
};

const chromeMock = {
  runtime: {
    onMessage: { addListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
    onStartup: { addListener: vi.fn() },
    getURL: vi.fn((path: string) => `chrome-extension://test/${path}`)
  },
  alarms: {
    onAlarm: { addListener: vi.fn() },
    create: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(undefined)
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined)
    },
    sync: {
      get: vi.fn().mockResolvedValue({})
    }
  },
  action: {
    setBadgeText: vi.fn().mockResolvedValue(undefined),
    setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
    setTitle: vi.fn().mockResolvedValue(undefined)
  },
  notifications: {
    create: vi.fn().mockResolvedValue(undefined)
  }
};

vi.stubGlobal("chrome", chromeMock);

let onMessageHandler: (message: unknown) => void;

const previousSnapshot: PointRecoverySnapshot = { hasPendingRecovery: true, availablePoints: 50 };
const currentSnapshot: PointRecoverySnapshot = { hasPendingRecovery: false, availablePoints: 100 };

const dispatchRecoveryObserved = async (): Promise<void> => {
  const message: ObservedMessage = {
    __type: POINT_RECOVERY_OBSERVED_MESSAGE_TYPE,
    snapshot: currentSnapshot
  };

  onMessageHandler(message);

  await vi.waitFor(() => expect(chromeMock.storage.local.set).toHaveBeenCalled());
};

describe("background: 無料コイン回復バッジ", () => {
  beforeAll(async () => {
    await import("./background");
    onMessageHandler = chromeMock.runtime.onMessage.addListener.mock.calls[0][0];
  });

  beforeEach(() => {
    // restoreMocks はスパイのみを対象にするため、chromeMock 側のプレーンな vi.fn() は
    // 呼び出し履歴・キュー済みの reject 設定が残る。テスト間で漏れないよう明示的にリセットする。
    chromeMock.storage.local.get.mockReset().mockResolvedValue({
      [POINT_RECOVERY_SNAPSHOT_KEY]: previousSnapshot
    });
    chromeMock.storage.local.set.mockReset().mockResolvedValue(undefined);
    chromeMock.storage.sync.get.mockReset().mockResolvedValue({});
    chromeMock.action.setBadgeText.mockReset().mockResolvedValue(undefined);
    chromeMock.action.setBadgeBackgroundColor.mockReset().mockResolvedValue(undefined);
    chromeMock.action.setTitle.mockReset().mockResolvedValue(undefined);
    chromeMock.notifications.create.mockReset().mockResolvedValue(undefined);
    chromeMock.alarms.create.mockReset().mockResolvedValue(undefined);
    chromeMock.alarms.get.mockReset().mockResolvedValue(undefined);
  });

  it("回復完了時にバッジ文字・背景色・action titleを設定する", async () => {
    await dispatchRecoveryObserved();

    expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: "1" });
    expect(chromeMock.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: "#c1432b" });
    expect(chromeMock.action.setTitle).toHaveBeenCalledWith({ title: "無料コインが回復しました" });
    expect(chromeMock.notifications.create).toHaveBeenCalled();
  });

  it("action APIが失敗しても通知作成とスナップショット保存は継続する", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    chromeMock.action.setBadgeText.mockRejectedValueOnce(new Error("badge text failed"));
    chromeMock.action.setBadgeBackgroundColor.mockRejectedValueOnce(new Error("badge color failed"));
    chromeMock.action.setTitle.mockRejectedValueOnce(new Error("title failed"));

    await dispatchRecoveryObserved();

    expect(chromeMock.notifications.create).toHaveBeenCalled();
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      [POINT_RECOVERY_SNAPSHOT_KEY]: currentSnapshot
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
  });
});
