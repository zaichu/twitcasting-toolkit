import {
  didPointRecoveryComplete,
  isPointRecoverySnapshot,
  parsePointRecoverySnapshotFromHtml,
  POINT_RECOVERY_ALARM_NAME,
  POINT_RECOVERY_CHECK_INTERVAL_MINUTES,
  POINT_RECOVERY_LOGGED_IN_USER_ID_KEY,
  POINT_RECOVERY_SNAPSHOT_KEY,
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
};

const ensureAlarm = (): void => {
  void chrome.alarms.create(POINT_RECOVERY_ALARM_NAME, {
    periodInMinutes: POINT_RECOVERY_CHECK_INTERVAL_MINUTES
  });
};

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POINT_RECOVERY_ALARM_NAME) {
    void checkPointRecovery();
  }
});

chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);
