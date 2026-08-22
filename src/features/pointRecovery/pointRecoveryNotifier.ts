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

const AVAILABLE_POINTS_TEXT_PATTERN =
  /(?:利用可能ポイント|保有ポイント|所持ポイント)[^\d]{0,10}([\d,]+)/;

const POINT_PURCHASE_HEADING_PATTERN = /([\d,]+)\s*ポイント購入/;

const POINT_RECOVERY_TEXT_PATTERN = /(あと.+?で)\s*[\d,]+\s*pt\s*(?:に)?\s*回復/;

const REMAINING_TIME_PATTERN =
  /あと\s*(?:(\d+)\s*日)?\s*(?:(\d+)\s*時間)?\s*(?:(\d+)\s*分)?\s*(?:(\d+)\s*秒)?\s*で/;

export const stripHtmlToText = (html: string): string => {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const parseAvailablePointsFromText = (text: string): number | undefined => {
  const match = text.match(AVAILABLE_POINTS_TEXT_PATTERN) ?? text.match(POINT_PURCHASE_HEADING_PATTERN);

  if (!match) {
    return undefined;
  }

  const value = Number(match[1].replace(/,/g, ""));

  return Number.isFinite(value) ? value : undefined;
};

export const extractPointRecoveryRemainingText = (text: string): string | undefined => {
  return text.match(POINT_RECOVERY_TEXT_PATTERN)?.[1];
};

export const hasPendingPointRecoveryInText = (text: string): boolean => {
  return extractPointRecoveryRemainingText(text) !== undefined;
};

export const parseRemainingMillisecondsFromText = (remainingText: string): number | undefined => {
  const match = remainingText.match(REMAINING_TIME_PATTERN);

  if (!match) {
    return undefined;
  }

  const [, days, hours, minutes, seconds] = match;

  if (days === undefined && hours === undefined && minutes === undefined && seconds === undefined) {
    return undefined;
  }

  const totalSeconds =
    Number(days ?? 0) * 24 * 60 * 60 +
    Number(hours ?? 0) * 60 * 60 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0);

  return totalSeconds > 0 ? totalSeconds * 1000 : undefined;
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
  options?: { notifyWhenPreviousUnknown?: boolean }
): boolean => {
  if (!previous) {
    return options?.notifyWhenPreviousUnknown === true && !current.hasPendingRecovery;
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
