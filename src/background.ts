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
const scheduleRecheck = (snapshot: PointRecoverySnapshot): void => {
  const delayMs = getNextCheckDelayMs(snapshot);

  if (delayMs === undefined) {
    return;
  }

  void chrome.alarms.create(POINT_RECOVERY_RECHECK_ALARM_NAME, {
    when: Date.now() + delayMs
  });
};

const checkPointRecovery = async (): Promise<void> => {
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
  const previousSnapshot = await getStoredSnapshot();

  if (didPointRecoveryComplete(previousSnapshot, currentSnapshot)) {
    notifyPointRecoveryCompleted(currentSnapshot.availablePoints);
  }

  await saveSnapshot(currentSnapshot);
  scheduleRecheck(currentSnapshot);
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
const handleStartup = (): void => {
  void ensureWatchAlarm();
  void checkPointRecovery();
};

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POINT_RECOVERY_WATCH_ALARM_NAME || alarm.name === POINT_RECOVERY_RECHECK_ALARM_NAME) {
    void checkPointRecovery();
  }
});

chrome.runtime.onInstalled.addListener(handleStartup);
chrome.runtime.onStartup.addListener(handleStartup);
