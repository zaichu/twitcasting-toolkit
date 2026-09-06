export type PointRecoverySnapshot = {
  availablePoints?: number;
  hasPendingRecovery: boolean;
  remainingText?: string;
};

export const POINT_RECOVERY_WATCH_ALARM_NAME = "twitcasting-toolkit:point-recovery-watch";
export const POINT_RECOVERY_RECHECK_ALARM_NAME = "twitcasting-toolkit:point-recovery-recheck";
export const POINT_RECOVERY_WATCH_INTERVAL_MINUTES = 30;
export const POINT_RECOVERY_RECHECK_BUFFER_MS = 60_000;
export const POINT_RECOVERY_LOGGED_IN_USER_ID_KEY = "twitCastingToolkitLoggedInUserId";
export const POINT_RECOVERY_SNAPSHOT_KEY = "twitCastingToolkitPointRecoverySnapshot";

export const POINT_RECOVERY_OBSERVED_MESSAGE_TYPE = "twitcasting-toolkit:point-recovery-observed";

export type PointRecoveryObservedMessage = {
  __type: typeof POINT_RECOVERY_OBSERVED_MESSAGE_TYPE;
  snapshot: PointRecoverySnapshot;
};

export const isPointRecoveryObservedMessage = (
  value: unknown
): value is PointRecoveryObservedMessage => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<PointRecoveryObservedMessage>;

  return (
    message.__type === POINT_RECOVERY_OBSERVED_MESSAGE_TYPE &&
    isPointRecoverySnapshot(message.snapshot)
  );
};

import {
  extractPointRecoveryRemainingText,
  hasPendingPointRecoveryInText,
  parseAvailablePointsFromText,
  parseRemainingMillisecondsFromText
} from "../point/pointText";

export {
  AVAILABLE_POINTS_TEXT_PATTERN,
  PAID_POINTS_TEXT_PATTERN,
  POINT_PURCHASE_HEADING_PATTERN,
  POINT_RECOVERY_TEXT_PATTERN,
  REMAINING_TIME_PATTERN
} from "../point/pointText";
export {
  extractPointRecoveryRemainingText,
  hasPendingPointRecoveryInText,
  parseAvailablePointsFromText,
  parseRemainingMillisecondsFromText
};

export const stripHtmlToText = (html: string): string => {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const parsePointRecoverySnapshotFromHtml = (html: string): PointRecoverySnapshot => {
  const text = stripHtmlToText(html);
  const remainingText = extractPointRecoveryRemainingText(text);

  return {
    availablePoints: parseAvailablePointsFromText(text),
    hasPendingRecovery: remainingText !== undefined,
    remainingText
  };
};

export const isPointRecoverySnapshot = (value: unknown): value is PointRecoverySnapshot => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as Partial<PointRecoverySnapshot>;

  return (
    typeof snapshot.hasPendingRecovery === "boolean" &&
    (snapshot.availablePoints === undefined || typeof snapshot.availablePoints === "number") &&
    (snapshot.remainingText === undefined || typeof snapshot.remainingText === "string")
  );
};

export const didPointRecoveryComplete = (
  previous: PointRecoverySnapshot | undefined,
  current: PointRecoverySnapshot,
  options?: { alwaysNotifyIfNotPending?: boolean }
): boolean => {
  if (options?.alwaysNotifyIfNotPending === true) {
    return !current.hasPendingRecovery;
  }

  if (!previous) {
    return false;
  }

  return previous.hasPendingRecovery && !current.hasPendingRecovery;
};

export const getNextCheckDelayMs = (snapshot: PointRecoverySnapshot): number | undefined => {
  if (!snapshot.hasPendingRecovery || snapshot.remainingText === undefined) {
    return undefined;
  }

  const remainingMs = parseRemainingMillisecondsFromText(snapshot.remainingText);

  return remainingMs !== undefined ? remainingMs + POINT_RECOVERY_RECHECK_BUFFER_MS : undefined;
};
