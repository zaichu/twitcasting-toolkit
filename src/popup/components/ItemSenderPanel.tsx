import { MAX_ITEM_SEND_COUNT } from "../../features/dom/domUtils";
import {
  getNextItemCountFromInput,
  type ActiveTab,
} from "../popupHelpers";
import type { UseItemSenderResult } from "../hooks/useItemSender";
import { PointSummary } from "./PointSummary";

type ItemSenderPanelProps = {
  tab: ActiveTab | undefined;
  itemSender: UseItemSenderResult;
};

export const ItemSenderPanel = ({ tab, itemSender }: ItemSenderPanelProps) => {
  const {
    itemSenderBusy: busy,
    itemCandidates,
    selectedItemIndex,
    setSelectedItemIndex: onSelectItem,
    pointSummaryItems,
    displayPointRecovery,
    pointRecoveryNotificationEnabled,
    updatePointRecoveryNotificationEnabled,
    itemCount,
    setItemCount,
    maxItemCount,
    maxItemCountDisabled,
    itemDisabled,
    sendItem,
    loadItemCandidates,
    itemResult,
  } = itemSender;
  const onNotificationChange = (enabled: boolean) =>
    void updatePointRecoveryNotificationEnabled(enabled);
  const onSendItem = () => void sendItem();
  const onLoadCandidates = () => void loadItemCandidates();
  return (
    <section className="tool-panel" aria-label="アイテム送信補助">
      <div className="field">
        <span>アイテム</span>
        <div className="item-picker" role="listbox" aria-label="アイテム">
          {itemCandidates.length === 0 ? (
            busy ? (
              <p className="empty-list">候補を読み込み中...</p>
            ) : (
              <div className="empty-list">
                <span>候補がありません</span>
                <button
                  type="button"
                  className="retry-button"
                  disabled={!tab || busy}
                  onClick={() => onLoadCandidates()}
                >
                  再試行
                </button>
              </div>
            )
          ) : (
            itemCandidates.map((candidate) => (
              <button
                key={`${candidate.index}-${candidate.itemId ?? candidate.label}`}
                type="button"
                className={candidate.index === selectedItemIndex ? "selected" : ""}
                disabled={!tab || busy}
                aria-pressed={candidate.index === selectedItemIndex}
                role="option"
                aria-selected={candidate.index === selectedItemIndex}
                onClick={() => onSelectItem(candidate.index)}
              >
                <span className="item-icon" aria-hidden="true">
                  {candidate.imageUrl ? (
                    <img src={candidate.imageUrl} alt="" />
                  ) : (
                    <span>{candidate.label.slice(0, 1)}</span>
                  )}
                </span>
                <span className="item-label">{candidate.label}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <PointSummary items={pointSummaryItems} />

      <div className="recovery-panel" aria-label="無料コイン回復">
        {displayPointRecovery && (
          <p className="point-recovery" aria-label="ポイント回復予定">
            {displayPointRecovery.remainingText} {displayPointRecovery.recoveredPoints} ptに回復
          </p>
        )}

        <label className="switch-row notification-setting">
          <span>
            <strong>無料コイン回復通知</strong>
            <small>回復したらデスクトップ通知でお知らせ</small>
          </span>
          <input
            type="checkbox"
            checked={pointRecoveryNotificationEnabled}
            onChange={(event) =>
              onNotificationChange(event.currentTarget.checked)
            }
          />
        </label>
      </div>

      <div className="field">
        <label htmlFor="item-count-input">回数</label>
        <div className="count-row">
          <input
            id="item-count-input"
            type="number"
            min={1}
            max={MAX_ITEM_SEND_COUNT}
            value={itemCount}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setItemCount((currentCount) =>
                getNextItemCountFromInput(value, currentCount)
              );
            }}
          />
          <button
            type="button"
            className="max-button"
            disabled={maxItemCountDisabled}
            onClick={() => {
              if (maxItemCount !== undefined) {
                setItemCount(maxItemCount);
              }
            }}
          >
            最大
          </button>
        </div>
      </div>

      <div className="actions one">
        <button type="button" onClick={() => onSendItem()} disabled={itemDisabled}>
          実行
        </button>
      </div>

      <p className="status">{itemCandidates.length} 件の候補を検出</p>

      {itemResult && (
        <p className="status">
          {itemResult.sent} / {itemResult.requested} 回実行
          {itemResult.stoppedReason ? `。${itemResult.stoppedReason}` : ""}
        </p>
      )}
    </section>
  );
};
