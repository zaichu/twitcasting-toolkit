import { beforeEach, describe, expect, it, vi } from "vitest";
import { SETTINGS_KEY } from "./extensionTypes";
import {
  POINT_RECOVERY_LOGGED_IN_USER_ID_KEY,
  POINT_RECOVERY_SNAPSHOT_KEY
} from "./features/pointRecovery/pointRecoveryNotifier";
import {
  getPointRecoverySnapshot,
  getStoredLoggedInUserId,
  isCheckboxRule,
  isPointRecoveryNotificationEnabled,
  normalizeSettings,
  saveLoggedInUserId,
  savePointRecoverySnapshot
} from "./storage";

const chromeMock = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined)
    },
    sync: {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined)
    }
  }
};

vi.stubGlobal("chrome", chromeMock);

describe("storage Facade", () => {
  beforeEach(() => {
    chromeMock.storage.local.get.mockReset();
    chromeMock.storage.local.set.mockReset().mockResolvedValue(undefined);
    chromeMock.storage.sync.get.mockReset();
    chromeMock.storage.sync.set.mockReset().mockResolvedValue(undefined);
  });

  describe("isCheckboxRule", () => {
    it("autoApply と check/uncheck の組み合わせだけ true", () => {
      expect(isCheckboxRule({ autoApply: true, action: "check" })).toBe(true);
      expect(isCheckboxRule({ autoApply: false, action: "uncheck" })).toBe(true);
    });

    it("不正な値は false", () => {
      expect(isCheckboxRule(undefined)).toBe(false);
      expect(isCheckboxRule({ autoApply: true, action: "invert" })).toBe(false);
      expect(isCheckboxRule({ autoApply: "yes", action: "check" })).toBe(false);
    });
  });

  describe("normalizeSettings", () => {
    it("不正な checkbox ルールを除外する", () => {
      const normalized = normalizeSettings({
        checkboxRules: {
          "example.com": { autoApply: true, action: "check" },
          "broken.com": { autoApply: true, action: "invert" }
        },
        pointRecoveryNotificationEnabled: false
      });

      expect(normalized.checkboxRules).toEqual({
        "example.com": { autoApply: true, action: "check" }
      });
      expect(normalized.pointRecoveryNotificationEnabled).toBe(false);
    });
  });

  describe("isPointRecoveryNotificationEnabled", () => {
    it("未設定・不正値は true(既定で通知する)", async () => {
      chromeMock.storage.sync.get.mockResolvedValue({});
      await expect(isPointRecoveryNotificationEnabled()).resolves.toBe(true);

      chromeMock.storage.sync.get.mockResolvedValue({
        [SETTINGS_KEY]: { pointRecoveryNotificationEnabled: "yes" }
      });
      await expect(isPointRecoveryNotificationEnabled()).resolves.toBe(true);
    });

    it("保存された boolean をそのまま返す", async () => {
      chromeMock.storage.sync.get.mockResolvedValue({
        [SETTINGS_KEY]: { pointRecoveryNotificationEnabled: false }
      });
      await expect(isPointRecoveryNotificationEnabled()).resolves.toBe(false);
    });
  });

  describe("logged-in user id", () => {
    it("空でない文字列だけ返す", async () => {
      chromeMock.storage.local.get.mockResolvedValue({
        [POINT_RECOVERY_LOGGED_IN_USER_ID_KEY]: "user123"
      });
      await expect(getStoredLoggedInUserId()).resolves.toBe("user123");

      chromeMock.storage.local.get.mockResolvedValue({
        [POINT_RECOVERY_LOGGED_IN_USER_ID_KEY]: ""
      });
      await expect(getStoredLoggedInUserId()).resolves.toBeUndefined();

      chromeMock.storage.local.get.mockResolvedValue({});
      await expect(getStoredLoggedInUserId()).resolves.toBeUndefined();
    });

    it("正しいキーで保存する", async () => {
      await saveLoggedInUserId("user123");
      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
        [POINT_RECOVERY_LOGGED_IN_USER_ID_KEY]: "user123"
      });
    });
  });

  describe("point recovery snapshot", () => {
    it("正しいスナップショットだけ返す", async () => {
      const snapshot = { hasPendingRecovery: true, availablePoints: 50 };
      chromeMock.storage.local.get.mockResolvedValue({
        [POINT_RECOVERY_SNAPSHOT_KEY]: snapshot
      });
      await expect(getPointRecoverySnapshot()).resolves.toEqual(snapshot);

      chromeMock.storage.local.get.mockResolvedValue({
        [POINT_RECOVERY_SNAPSHOT_KEY]: { hasPendingRecovery: "yes" }
      });
      await expect(getPointRecoverySnapshot()).resolves.toBeUndefined();
    });

    it("正しいキーで保存する", async () => {
      const snapshot = { hasPendingRecovery: false, availablePoints: 100 };
      await savePointRecoverySnapshot(snapshot);
      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
        [POINT_RECOVERY_SNAPSHOT_KEY]: snapshot
      });
    });
  });
});
