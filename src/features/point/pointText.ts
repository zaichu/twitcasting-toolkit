export const AVAILABLE_POINTS_TEXT_PATTERN =
  /(?:利用可能ポイント|保有ポイント|所持ポイント)[^\d]{0,10}([\d,]+)/;

export const POINT_PURCHASE_HEADING_PATTERN = /([\d,]+)\s*ポイント購入/;

export const POINT_RECOVERY_TEXT_PATTERN = /(あと.+?で)\s*([\d,]+)\s*pt\s*(?:に)?\s*回復/;

export const REMAINING_TIME_PATTERN =
  /あと\s*(?:(\d+)\s*日)?\s*(?:(\d+)\s*時間)?\s*(?:(\d+)\s*分)?\s*(?:(\d+)\s*秒)?\s*で/;

export const PAID_POINTS_TEXT_PATTERN = /有料ポイント\s*([\d,]+)\s*含む/;

export type PointRecoveryText = {
  remainingText: string;
  recoveredPoints: number;
};

const normalizePointText = (text: string): string => {
  return text.replace(/\s+/g, " ").trim();
};

const toNumber = (value: string): number | undefined => {
  const parsed = Number(value.replace(/,/g, ""));

  return Number.isFinite(parsed) ? parsed : undefined;
};

export const parseAvailablePointsFromText = (text: string): number | undefined => {
  const normalized = normalizePointText(text);
  const match =
    normalized.match(AVAILABLE_POINTS_TEXT_PATTERN) ??
    normalized.match(POINT_PURCHASE_HEADING_PATTERN);

  if (!match) {
    return undefined;
  }

  return toNumber(match[1]);
};

export const parsePointRecoveryFromText = (text: string): PointRecoveryText | undefined => {
  const match = normalizePointText(text).match(POINT_RECOVERY_TEXT_PATTERN);

  if (!match) {
    return undefined;
  }

  const recoveredPoints = toNumber(match[2]);

  if (recoveredPoints === undefined) {
    return undefined;
  }

  return {
    remainingText: match[1],
    recoveredPoints
  };
};

export const extractPointRecoveryRemainingText = (text: string): string | undefined => {
  return parsePointRecoveryFromText(text)?.remainingText;
};

export const hasPendingPointRecoveryInText = (text: string): boolean => {
  return extractPointRecoveryRemainingText(text) !== undefined;
};

export const parseRemainingMillisecondsFromText = (
  remainingText: string
): number | undefined => {
  const match = normalizePointText(remainingText).match(REMAINING_TIME_PATTERN);

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

export const parsePaidPointsFromText = (text: string): number | undefined => {
  const match = normalizePointText(text).match(PAID_POINTS_TEXT_PATTERN);

  if (!match) {
    return undefined;
  }

  return toNumber(match[1]);
};
