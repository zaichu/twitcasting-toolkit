import type {
  CheckboxActionResult,
  CheckboxState,
  PointStatus
} from "../extensionTypes";

import {
  clampItemSendCount,
  clampItemSendDelay,
  MAX_ITEM_SEND_COUNT,
  MIN_ITEM_SEND_DELAY_MS
} from "../features/dom/domUtils";

// clamp 関数の単一ソースは features/dom/domUtils.ts。content script は独立 iife
// ビルドのため popup と共有してもビルドは壊れない。既存の import 経路
// (`./popupHelpers` からの clamp 参照) を保つための再エクスポート。
export { clampItemSendCount, clampItemSendDelay };

export const MAX_POPUP_ITEM_SEND_COUNT = MAX_ITEM_SEND_COUNT;
export const ITEM_SEND_DELAY_MS = MIN_ITEM_SEND_DELAY_MS;

export type ActiveTab = {
  id: number;
  url: string;
  host: string;
};

export type Tool = "checkbox" | "item-sender";

export const formatCheckboxStatus = (
  state: CheckboxState | CheckboxActionResult | undefined
): string => {
  if (!state) {
    return "TwitCasting のページを開いてください";
  }

  if ("changed" in state) {
    return `${state.changed} 件変更 / ${state.checked} 件選択中`;
  }

  return `${state.checked} / ${state.total} 件選択中`;
};

export const getMaxItemCountFromPoints = (
  availablePoints: number | undefined,
  point: number | undefined
): number | undefined => {
  if (availablePoints === undefined || point === undefined || point <= 0) {
    return undefined;
  }

  const maxCount = Math.floor(availablePoints / point);

  return maxCount > 0 ? Math.min(maxCount, MAX_POPUP_ITEM_SEND_COUNT) : undefined;
};

export const getNextItemCountFromInput = (value: string, currentCount: number): number => {
  if (value === "") {
    return currentCount;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return currentCount;
  }

  return Math.max(1, Math.min(Math.trunc(parsed), MAX_POPUP_ITEM_SEND_COUNT));
};

export type PointSummaryItem = {
  label: string;
  value: string;
};

const formatPointValue = (point: number | undefined): string => {
  return point !== undefined ? `${point} pt` : "不明";
};

export const getPointSummaryItems = (
  pointStatus: PointStatus | undefined,
  availablePoints: number | undefined,
  selectedItemPoint: number | undefined
): PointSummaryItem[] => {
  const primaryPoint = pointStatus?.ownedPoints ?? pointStatus?.availablePoints ?? availablePoints;
  const primaryLabel = pointStatus?.ownedPoints !== undefined ? "所有" : "利用可能";

  return [
    {
      label: primaryLabel,
      value: formatPointValue(primaryPoint)
    },
    {
      label: "有料",
      value: formatPointValue(pointStatus?.paidPoints)
    },
    {
      label: "消費",
      value: selectedItemPoint !== undefined ? `${selectedItemPoint} pt/回` : "-"
    }
  ];
};
