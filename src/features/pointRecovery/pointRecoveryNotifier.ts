export type PointRecoverySnapshot = {
  availablePoints?: number;
  hasPendingRecovery: boolean;
};

export const POINT_RECOVERY_ALARM_NAME = "twitcasting-toolkit:point-recovery-check";
export const POINT_RECOVERY_CHECK_INTERVAL_MINUTES = 5;
export const POINT_RECOVERY_LOGGED_IN_USER_ID_KEY = "twitCastingToolkitLoggedInUserId";
export const POINT_RECOVERY_SNAPSHOT_KEY = "twitCastingToolkitPointRecoverySnapshot";

const AVAILABLE_POINTS_TEXT_PATTERN =
  /(?:利用可能ポイント|保有ポイント|所持ポイント)[^\d]{0,10}([\d,]+)/;

const POINT_PURCHASE_HEADING_PATTERN = /([\d,]+)\s*ポイント購入/;

const POINT_RECOVERY_TEXT_PATTERN = /あと.+?で\s*[\d,]+\s*pt\s*(?:に)?\s*回復/;

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

export const hasPendingPointRecoveryInText = (text: string): boolean => {
  return POINT_RECOVERY_TEXT_PATTERN.test(text);
};

export const parsePointRecoverySnapshotFromHtml = (html: string): PointRecoverySnapshot => {
  const text = stripHtmlToText(html);

  return {
    availablePoints: parseAvailablePointsFromText(text),
    hasPendingRecovery: hasPendingPointRecoveryInText(text)
  };
};

export const isPointRecoverySnapshot = (value: unknown): value is PointRecoverySnapshot => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as Partial<PointRecoverySnapshot>;

  return (
    typeof snapshot.hasPendingRecovery === "boolean" &&
    (snapshot.availablePoints === undefined || typeof snapshot.availablePoints === "number")
  );
};

export const didPointRecoveryComplete = (
  previous: PointRecoverySnapshot | undefined,
  current: PointRecoverySnapshot
): boolean => {
  if (!previous) {
    return false;
  }

  return previous.hasPendingRecovery && !current.hasPendingRecovery;
};
