import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRecoveryIndicator } from "./popupChrome";

describe("resetRecoveryIndicator", () => {
  const chromeMock = {
    action: {
      setBadgeText: vi.fn(),
      setTitle: vi.fn()
    },
    runtime: {
      getManifest: vi.fn()
    }
  };

  beforeEach(() => {
    chromeMock.action.setBadgeText.mockReset().mockResolvedValue(undefined);
    chromeMock.action.setTitle.mockReset().mockResolvedValue(undefined);
    chromeMock.runtime.getManifest
      .mockReset()
      .mockReturnValue({ action: { default_title: "TwitCasting Toolkit" } });
    vi.stubGlobal("chrome", chromeMock);
  });

  it("バッジ文字とaction titleを既定状態(manifestのdefault_title)へ戻す", async () => {
    await resetRecoveryIndicator();

    expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
    expect(chromeMock.action.setTitle).toHaveBeenCalledWith({ title: "TwitCasting Toolkit" });
  });

  it("バッジ文字の設定が失敗してもtitleの復元は実行し、rejectしない", async () => {
    chromeMock.action.setBadgeText.mockRejectedValueOnce(new Error("badge text failed"));

    await expect(resetRecoveryIndicator()).resolves.toBeUndefined();

    expect(chromeMock.action.setTitle).toHaveBeenCalledWith({ title: "TwitCasting Toolkit" });
  });

  it("titleの設定が失敗してもバッジ文字の消去は実行し、rejectしない", async () => {
    chromeMock.action.setTitle.mockRejectedValueOnce(new Error("title failed"));

    await expect(resetRecoveryIndicator()).resolves.toBeUndefined();

    expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
  });
});
