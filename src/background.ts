import {
  didPointRecoveryComplete,
  getNextCheckDelayMs,
  isPointRecoverySnapshot,
  parsePointRecoverySnapshotFromHtml,
  POINT_RECOVERY_LOGGED_IN_USER_ID_KEY,
  POINT_RECOVERY_RECHECK_ALARM_NAME,
  POINT_RECOVERY_SNAPSHOT_KEY,
  POINT_RECOVERY_WATCH_ALARM_NAME,
  POINT_RECOVERY_WATCH_INTERVAL_MINUTES,
  PointRecoverySnapshot
} from "./features/pointRecovery/pointRecoveryNotifier";

// content.ts の POINT_RECOVERY_OBSERVED_MESSAGE_TYPE と同じ値。
const POINT_RECOVERY_OBSERVED_MESSAGE_TYPE = "twitcasting-toolkit:point-recovery-observed";
// extensionTypes.ts の SETTINGS_KEY と同じ値。値の import による chunk 分割を
// 避けるため文字列を複製する。
const SETTINGS_KEY = "twitCastingToolkitSettings";

type PointRecoveryObservedMessage = {
  __type: typeof POINT_RECOVERY_OBSERVED_MESSAGE_TYPE;
  snapshot: PointRecoverySnapshot;
};

const isPointRecoveryObservedMessage = (value: unknown): value is PointRecoveryObservedMessage => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<PointRecoveryObservedMessage>;

  return message.__type === POINT_RECOVERY_OBSERVED_MESSAGE_TYPE && isPointRecoverySnapshot(message.snapshot);
};

const getStoredLoggedInUserId = async (): Promise<string | undefined> => {
  const stored = await chrome.storage.local.get(POINT_RECOVERY_LOGGED_IN_USER_ID_KEY);
  const value = stored[POINT_RECOVERY_LOGGED_IN_USER_ID_KEY];

  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const getStoredSnapshot = async (): Promise<PointRecoverySnapshot | undefined> => {
  const stored = await chrome.storage.local.get(POINT_RECOVERY_SNAPSHOT_KEY);
  const value = stored[POINT_RECOVERY_SNAPSHOT_KEY];

  return isPointRecoverySnapshot(value) ? value : undefined;
};

const saveSnapshot = (snapshot: PointRecoverySnapshot): Promise<void> => {
  return chrome.storage.local.set({ [POINT_RECOVERY_SNAPSHOT_KEY]: snapshot });
};

const isPointRecoveryNotificationEnabled = async (): Promise<boolean> => {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  const settings = stored[SETTINGS_KEY];

  if (!settings || typeof settings !== "object") {
    return true;
  }

  const enabled = (settings as { pointRecoveryNotificationEnabled?: unknown })
    .pointRecoveryNotificationEnabled;

  return typeof enabled === "boolean" ? enabled : true;
};

const notifyPointRecoveryCompleted = async (availablePoints: number | undefined): Promise<void> => {
  try {
    await chrome.notifications.create(`twitcasting-toolkit:point-recovery:${Date.now()}`, {
      type: "basic",
      // service worker では相対パスの iconUrl を解決できないため絶対URLに変換する。
      iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
      title: "TwitCasting Toolkit",
      message:
        availablePoints !== undefined
          ? `無料コインが回復しました(利用可能 ${availablePoints} pt)`
          : "無料コインが回復しました"
    });
  } catch (error) {
    console.error("[TwitCasting Toolkit] 通知の作成に失敗しました", error);
  }
};

// 回復予定時刻が判明していればその時刻付近に一度だけ再チェックする。
// 判明しない場合(表記が変わった、回復待ちでない等)は POINT_RECOVERY_WATCH_ALARM_NAME の
// 定期実行に検知を委ねる。
const scheduleRecheck = (snapshot: PointRecoverySnapshot): Promise<void> => {
  const delayMs = getNextCheckDelayMs(snapshot);

  if (delayMs === undefined) {
    return Promise.resolve();
  }

  return chrome.alarms.create(POINT_RECOVERY_RECHECK_ALARM_NAME, {
    when: Date.now() + delayMs
  });
};

// 通知判定・保存・次回チェックのスケジューリングを一箇所にまとめる。
// fetch で取得したスナップショット、popup 経由で観測されたスナップショットの
// どちらもここを通す。
const evaluateAndPersistSnapshot = async (
  currentSnapshot: PointRecoverySnapshot,
  options?: { alwaysNotifyIfNotPending?: boolean }
): Promise<void> => {
  const previousSnapshot = await getStoredSnapshot();

  if (didPointRecoveryComplete(previousSnapshot, currentSnapshot, options)) {
    if (await isPointRecoveryNotificationEnabled()) {
      await notifyPointRecoveryCompleted(currentSnapshot.availablePoints);
    }
  }

  await saveSnapshot(currentSnapshot);
  await scheduleRecheck(currentSnapshot);
};

const checkPointRecovery = async (trigger: string): Promise<void> => {
  const userId = await getStoredLoggedInUserId();

  if (!userId) {
    return;
  }

  let html: string;

  try {
    const response = await fetch(`https://twitcasting.tv/${encodeURIComponent(userId)}/points`, {
      credentials: "include"
    });

    if (!response.ok) {
      return;
    }

    html = await response.text();
  } catch {
    return;
  }

  const currentSnapshot = parsePointRecoverySnapshotFromHtml(html);
  // ブラウザ起動/拡張機能の読み込み直後は、前回との差分に関わらず
  // 「その時点で満タンなら常に通知する」。他のトリガー(定期見張り・recheck・
  // popup観測)では、回復待ち→解消という差分があった時だけ通知する。
  const isStartupTrigger = trigger === "onInstalled" || trigger === "onStartup";
  await evaluateAndPersistSnapshot(currentSnapshot, { alwaysNotifyIfNotPending: isStartupTrigger });
};

// popup 操作(アイテム候補取得)で content script が観測した最新のポイント状態。
// background は 30 分間隔でしかポイント状態を確認しないため、これが無いと
// popup を使うだけでは回復待ち検知(recheck アラーム)が始まらない。
const handleObservedSnapshot = (snapshot: PointRecoverySnapshot): Promise<void> => {
  return evaluateAndPersistSnapshot(snapshot);
};

// periodInMinutes だけで再作成すると起動のたびに次回発火が延期されてしまうため、
// 既存のアラームが無いときだけ作成する。
const ensureWatchAlarm = async (): Promise<void> => {
  const existingAlarm = await chrome.alarms.get(POINT_RECOVERY_WATCH_ALARM_NAME);

  if (existingAlarm) {
    return;
  }

  await chrome.alarms.create(POINT_RECOVERY_WATCH_ALARM_NAME, {
    periodInMinutes: POINT_RECOVERY_WATCH_INTERVAL_MINUTES
  });
};

// ブラウザ起動時点で既に回復済みになっているケースを次のアラームまで
// 待たせないよう、起動直後にも一度確認する。
const handleStartup = (source: string): void => {
  void ensureWatchAlarm();
  void checkPointRecovery(source);
};

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POINT_RECOVERY_WATCH_ALARM_NAME || alarm.name === POINT_RECOVERY_RECHECK_ALARM_NAME) {
    void checkPointRecovery(alarm.name);
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (isPointRecoveryObservedMessage(message)) {
    void handleObservedSnapshot(message.snapshot);
  }
});

chrome.runtime.onInstalled.addListener(() => handleStartup("onInstalled"));
chrome.runtime.onStartup.addListener(() => handleStartup("onStartup"));
