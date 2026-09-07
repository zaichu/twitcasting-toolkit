import { useState, type Dispatch, type SetStateAction } from "react";
import type {
  ItemCandidate,
  ItemCandidateListResult,
  ItemSendResult,
  PointRecovery,
  PointStatus
} from "../../extensionTypes";
import { savePointRecoveryNotificationEnabled } from "../../storage";
import { sendToTab } from "../popupChrome";
import { runItemSendInMainWorld } from "../mainWorldItemSend";
import {
  clampItemSendCount,
  clampItemSendDelay,
  MIN_ITEM_SEND_DELAY_MS
} from "../../features/dom/domUtils";
import {
  getMaxItemCountFromPoints,
  getPointSummaryItems,
  type ActiveTab
} from "../popupHelpers";

type UseItemSenderOptions = {
  tab: ActiveTab | undefined;
  setError: Dispatch<SetStateAction<string | undefined>>;
};

export const useItemSender = ({ tab, setError }: UseItemSenderOptions) => {
  const [itemSenderBusy, setItemSenderBusy] = useState(false);
  const [itemCandidates, setItemCandidates] = useState<ItemCandidate[]>([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>();
  const [availablePoints, setAvailablePoints] = useState<number>();
  const [pointRecovery, setPointRecovery] = useState<PointRecovery>();
  const [pointStatus, setPointStatus] = useState<PointStatus>();
  const [itemCount, setItemCount] = useState(1);
  const [itemResult, setItemResult] = useState<ItemSendResult>();
  const [pointRecoveryNotificationEnabled, setPointRecoveryNotificationEnabled] = useState(true);

  const syncNotificationSetting = (enabled: boolean) => {
    setPointRecoveryNotificationEnabled(enabled);
  };

  const clearItemState = () => {
    setItemCandidates([]);
    setSelectedItemIndex(undefined);
    setAvailablePoints(undefined);
    setPointRecovery(undefined);
    setPointStatus(undefined);
  };

  const loadItemCandidates = async (
    targetTab?: ActiveTab,
    options?: { resetResult?: boolean }
  ) => {
    const currentTab = targetTab ?? tab;

    if (!currentTab) {
      return;
    }

    setItemSenderBusy(true);
    setError(undefined);

    if (options?.resetResult !== false) {
      setItemResult(undefined);
    }

    try {
      const result = await sendToTab<ItemCandidateListResult>(currentTab.id, {
        feature: "item-sender",
        type: "list"
      });
      setItemCandidates(result.candidates);
      setAvailablePoints(result.availablePoints);
      setPointRecovery(result.pointRecovery);
      setPointStatus(result.pointStatus);
      setSelectedItemIndex((currentIndex) => {
        if (result.candidates.some((candidate) => candidate.index === currentIndex)) {
          return currentIndex;
        }

        return result.candidates[0]?.index;
      });
    } catch (error) {
      setItemCandidates([]);
      setSelectedItemIndex(undefined);
      setAvailablePoints(undefined);
      setPointRecovery(undefined);
      setPointStatus(undefined);
      setError(`アイテム候補の取得に失敗しました: ${String(error)}`);
    } finally {
      setItemSenderBusy(false);
    }
  };

  const updatePointRecoveryNotificationEnabled = async (enabled: boolean) => {
    setPointRecoveryNotificationEnabled(enabled);
    await savePointRecoveryNotificationEnabled(enabled);
  };

  const selectedItem = itemCandidates.find((candidate) => candidate.index === selectedItemIndex);

  const sendItem = async () => {
    if (!tab || !selectedItem) {
      return;
    }

    setItemSenderBusy(true);
    setError(undefined);
    setItemResult(undefined);

    try {
      const result = await runItemSendInMainWorld(
        tab.id,
        {
          candidateIndex: selectedItem.index,
          label: selectedItem.label,
          userId: selectedItem.userId,
          itemId: selectedItem.itemId,
          // MAIN world の func 内では外部モジュールを参照できないため、
          // popup スコープ (MAIN world ではない) で事前にクランプして渡す。
          count: clampItemSendCount(itemCount),
          delayMs: clampItemSendDelay(MIN_ITEM_SEND_DELAY_MS)
        },
        tab.host
      );
      setItemResult(result);
    } catch (error) {
      setError(`アイテム送信操作に失敗しました: ${String(error)}`);
    } finally {
      setItemSenderBusy(false);
    }

    // 送信で消費したポイント状態を反映し、background の回復検知にも同期する。
    await loadItemCandidates(tab, { resetResult: false });
  };

  const maxItemCount = getMaxItemCountFromPoints(availablePoints, selectedItem?.point);
  const pointSummaryItems = getPointSummaryItems(pointStatus, availablePoints, selectedItem?.point);
  const displayPointRecovery = pointStatus?.pointRecovery ?? pointRecovery;
  const itemDisabled = !tab || itemSenderBusy || selectedItemIndex === undefined;
  const maxItemCountDisabled = !tab || itemSenderBusy || maxItemCount === undefined;

  return {
    itemSenderBusy,
    itemCandidates,
    selectedItemIndex,
    setSelectedItemIndex,
    pointSummaryItems,
    displayPointRecovery,
    pointRecoveryNotificationEnabled,
    itemCount,
    setItemCount,
    maxItemCount,
    maxItemCountDisabled,
    itemDisabled,
    itemResult,
    loadItemCandidates,
    sendItem,
    updatePointRecoveryNotificationEnabled,
    syncNotificationSetting,
    clearItemState
  };
};
