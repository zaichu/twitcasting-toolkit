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

// 動作確認用のデバッグログ。Service Worker の console は起動直後のログを
// 見逃しやすいため、chrome.storage.local にも直近件数を残す。
// 原因調査が終わり次第、削除予定の一時対応。
const DEBUG_LOG_KEY = "twitCastingToolkitDebugLog";
const DEBUG_LOG_MAX_ENTRIES = 50;

const logDebug = async (message: string): Promise<void> => {
  const entry = `${new Date().toISOString()} ${message}`;
  console.log(`[TwitCasting Toolkit] ${entry}`);

  const stored = await chrome.storage.local.get(DEBUG_LOG_KEY);
  const currentLog = Array.isArray(stored[DEBUG_LOG_KEY]) ? (stored[DEBUG_LOG_KEY] as string[]) : [];
  const nextLog = [...currentLog, entry].slice(-DEBUG_LOG_MAX_ENTRIES);

  await chrome.storage.local.set({ [DEBUG_LOG_KEY]: nextLog });
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

const notifyPointRecoveryCompleted = (availablePoints: number | undefined): void => {
  chrome.notifications.create(`twitcasting-toolkit:point-recovery:${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title: "TwitCasting Toolkit",
    message:
      availablePoints !== undefined
        ? `無料コインが回復しました(利用可能 ${availablePoints} pt)`
        : "無料コインが回復しました"
  });
};

// 回復予定時刻が判明していればその時刻付近に一度だけ再チェックする。
// 判明しない場合(表記が変わった、回復待ちでない等)は POINT_RECOVERY_WATCH_ALARM_NAME の
// 定期実行に検知を委ねる。
const scheduleRecheck = async (snapshot: PointRecoverySnapshot): Promise<void> => {
  const delayMs = getNextCheckDelayMs(snapshot);

  if (delayMs === undefined) {
    await logDebug("scheduleRecheck: skip (not pending or unparsable remainingText)");
    return;
  }

  await chrome.alarms.create(POINT_RECOVERY_RECHECK_ALARM_NAME, {
    when: Date.now() + delayMs
  });
  await logDebug(`scheduleRecheck: alarm set for +${Math.round(delayMs / 1000)}s`);
};

// 通知判定・保存・次回チェックのスケジューリングを一箇所にまとめる。
// fetch で取得したスナップショット、popup 経由で観測されたスナップショットの
// どちらもここを通す。
const evaluateAndPersistSnapshot = async (
  currentSnapshot: PointRecoverySnapshot,
  source: string
): Promise<void> => {
  const previousSnapshot = await getStoredSnapshot();

  await logDebug(
    `${source}: previous=${JSON.stringify(previousSnapshot)} current=${JSON.stringify(currentSnapshot)}`
  );

  if (didPointRecoveryComplete(previousSnapshot, currentSnapshot)) {
    await logDebug(`${source}: recovery completed -> notify`);
    notifyPointRecoveryCompleted(currentSnapshot.availablePoints);
  }

  await saveSnapshot(currentSnapshot);
  await scheduleRecheck(currentSnapshot);
};

const checkPointRecovery = async (trigger: string): Promise<void> => {
  await logDebug(`checkPointRecovery start (trigger=${trigger})`);

  const userId = await getStoredLoggedInUserId();

  if (!userId) {
    await logDebug("checkPointRecovery: no stored userId, abort");
    return;
  }

  let html: string;

  try {
    const response = await fetch(`https://twitcasting.tv/${encodeURIComponent(userId)}/points`, {
      credentials: "include"
    });

    if (!response.ok) {
      await logDebug(`checkPointRecovery: fetch not ok (status=${response.status})`);
      return;
    }

    html = await response.text();
  } catch (error) {
    await logDebug(`checkPointRecovery: fetch failed (${String(error)})`);
    return;
  }

  const currentSnapshot = parsePointRecoverySnapshotFromHtml(html);
  await evaluateAndPersistSnapshot(currentSnapshot, "checkPointRecovery");
};

// popup 操作(アイテム候補取得)で content script が観測した最新のポイント状態。
// background は 30 分間隔でしかポイント状態を確認しないため、これが無いと
// popup を使うだけでは回復待ち検知(recheck アラーム)が始まらない。
const handleObservedSnapshot = async (snapshot: PointRecoverySnapshot): Promise<void> => {
  await evaluateAndPersistSnapshot(snapshot, "observed");
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
  void logDebug(`handleStartup fired (source=${source})`);
  void ensureWatchAlarm();
  void checkPointRecovery(source);
};

void logDebug("background script evaluated");

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
