import { useEffect, useState } from "react";
import {
  CheckboxAction,
  CheckboxActionResult,
  CheckboxRule,
  CheckboxState,
  ExtensionMessage,
  ItemCandidate,
  ItemCandidateListResult,
  ItemSendRequest,
  ItemSendResult,
  PointRecovery,
  PointStatus
} from "../extensionTypes";
import { getSettings, savePointRecoveryNotificationEnabled, saveCheckboxRule } from "../storage";

const MAX_POPUP_ITEM_SEND_COUNT = 20;
const ITEM_SEND_DELAY_MS = 300;

// features/dom/domUtils.ts と同じ値。popup(このファイル)は content script
// (itemSender.ts) が import する domUtils.ts を一緒に import すると、Vite が
// 共有 chunk を作ってしまい content script 側に ESM import が混入してビルドが
// 壊れる(content script は classic script として読み込まれ import を使えない)。
// そのため値を複製する。
const clampItemSendCount = (count: number): number => {
  return Math.max(1, Math.min(count, MAX_POPUP_ITEM_SEND_COUNT));
};

const clampItemSendDelay = (delayMs: number): number => {
  return Math.max(300, Math.min(delayMs, 5000));
};

type ActiveTab = {
  id: number;
  url: string;
  host: string;
};

type Tool = "checkbox" | "item-sender";

const twitCastingUrlPattern = /^https:\/\/([^.]+\.)?twitcasting\.tv\//;

const DEFAULT_ACTION_TITLE = "TwitCasting Toolkit";

// popup を開いた = 回復通知に気づいたとみなし、ツールバーバッジと action titleを
// 既定状態に戻す。一方のaction APIがrejectしても他方の実行や
// 未処理Promise rejectionの発生を妨げないよう、Promise.allSettledでまとめる。
export const resetRecoveryIndicator = async (): Promise<void> => {
  const results = await Promise.allSettled([
    chrome.action.setBadgeText({ text: "" }),
    chrome.action.setTitle({
      title: chrome.runtime.getManifest().action?.default_title ?? DEFAULT_ACTION_TITLE
    })
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[TwitCasting Toolkit] 回復通知インジケーターのリセットに失敗しました", result.reason);
    }
  }
};

const getActiveTab = async (): Promise<ActiveTab | undefined> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url || !twitCastingUrlPattern.test(tab.url)) {
    return undefined;
  }

  return {
    id: tab.id,
    url: tab.url,
    host: new URL(tab.url).host
  };
};

const sendToTab = async <TResponse,>(
  tabId: number,
  message: ExtensionMessage
): Promise<TResponse> => {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["assets/content.js"]
    });

    return chrome.tabs.sendMessage(tabId, message);
  }
};

const formatCheckboxStatus = (state: CheckboxState | CheckboxActionResult | undefined): string => {
  if (!state) {
    return "TwitCasting のページを開いてください";
  }

  if ("changed" in state) {
    return `${state.changed} 件変更 / ${state.checked} 件選択中`;
  }

  return `${state.checked} / ${state.total} 件選択中`;
};

const runItemSendInMainWorld = async (
  tabId: number,
  request: ItemSendRequest,
  host: string
): Promise<ItemSendResult> => {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [request, host],
    func: async (sendRequest: ItemSendRequest, pageHost: string): Promise<ItemSendResult> => {
      // NOTE: この func は MAIN world にシリアライズ注入されるため、外部モジュール
      // (domUtils.ts 等) を import 参照できない。以下の DOM 操作関数は意図的に
      // func 内に残している。count / delayMs は呼び出し側 (sendItem) で事前に
      // クランプ済みの前提のため、ここでの clamp 再定義は不要。
      const sendButtonTimeoutMs = 10000;
      const sendButtonPollMs = 100;
      const insufficientPointsMessage = "必要なポイントが不足しています。";

      type GiftItemWindow = Window & {
        giftItem?: (userId: string, itemId?: string, usePoint?: boolean) => unknown;
      };

      const wait = (ms: number): Promise<void> => {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
      };

      const isDisabledElement = (element: Element): boolean => {
        if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) {
          return element.disabled;
        }

        return element.getAttribute("aria-disabled") === "true";
      };

      const isVisibleElement = (element: HTMLElement): boolean => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      };

      const pressElement = (element: HTMLElement) => {
        element.scrollIntoView?.({ block: "center", inline: "center" });
        element.focus({ preventScroll: true });

        const pointerOptions = {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "mouse"
        };
        const mouseOptions = {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1
        };
        const PointerEventConstructor = globalThis.PointerEvent ?? MouseEvent;

        element.dispatchEvent(new PointerEventConstructor("pointerdown", pointerOptions));
        element.dispatchEvent(new MouseEvent("mousedown", mouseOptions));
        element.dispatchEvent(new PointerEventConstructor("pointerup", pointerOptions));
        element.dispatchEvent(new MouseEvent("mouseup", mouseOptions));
        element.click();
      };

      const getPointSendButton = (): HTMLElement | undefined => {
        const selectors = [
          '#tw-item-window-data .tw-item-send-post[data-sendable="true"] #messagelink',
          "#tw-item-window-data #gift_form #messagelink",
          "#gift_form #messagelink"
        ];

        return selectors
          .map((selector) => document.querySelector<HTMLElement>(selector))
          .find(
            (element): element is HTMLElement =>
              Boolean(element && !isDisabledElement(element) && isVisibleElement(element))
          );
      };

      const hasInsufficientPointsMessage = (): boolean => {
        const selectors = ["#tw-item-window-data", ".tw-snackbar"];

        return selectors.some((selector) => {
          const element = document.querySelector<HTMLElement>(selector);

          return Boolean(element && element.textContent?.includes(insufficientPointsMessage));
        });
      };

      const waitForSendReadyState = async (): Promise<
        | {
            type: "send-button";
            button: HTMLElement;
          }
        | {
            type: "insufficient-points";
          }
        | {
            type: "timeout";
          }
      > => {
        const startedAt = Date.now();

        while (Date.now() - startedAt <= sendButtonTimeoutMs) {
          if (hasInsufficientPointsMessage()) {
            return { type: "insufficient-points" };
          }

          const button = getPointSendButton();

          if (button) {
            return { type: "send-button", button };
          }

          await wait(sendButtonPollMs);
        }

        return { type: "timeout" };
      };

      const findItemAnchor = (): HTMLElement | undefined => {
        if (!sendRequest.itemId) {
          return undefined;
        }

        const escapedItemId = sendRequest.itemId.replace(/["\\]/g, "\\$&");
        const selectors = [
          `a[href*="'${escapedItemId}'"][href*="giftItem("]`,
          `a[href*="\\"${escapedItemId}\\""][href*="giftItem("]`
        ];

        return selectors
          .map((selector) => document.querySelector<HTMLElement>(selector))
          .find((element): element is HTMLElement =>
            Boolean(element && !isDisabledElement(element))
          );
      };

      const openGiftWindow = async (): Promise<boolean> => {
        if (sendRequest.userId && sendRequest.itemId) {
          const giftItem = (window as GiftItemWindow).giftItem;

          if (typeof giftItem === "function") {
            giftItem(sendRequest.userId, sendRequest.itemId, true);
            return true;
          }
        }

        const itemAnchor = findItemAnchor();

        if (itemAnchor) {
          pressElement(itemAnchor);
          return true;
        }

        return false;
      };

      // sendItem 側で clampItemSendCount / clampItemSendDelay 済みの値を前提とする。
      const count = sendRequest.count;
      const delayMs = sendRequest.delayMs;
      const query = sendRequest.label ?? sendRequest.query ?? sendRequest.itemId ?? "";
      let sent = 0;

      for (let index = 0; index < count; index += 1) {
        const opened = await openGiftWindow();

        if (!opened) {
          return {
            host: pageHost,
            query,
            requested: count,
            sent,
            stoppedReason: "giftItem が見つからず、アイテム送信画面を開けませんでした"
          };
        }

        const sendReadyState = await waitForSendReadyState();

        if (sendReadyState.type === "insufficient-points") {
          return {
            host: pageHost,
            query,
            requested: count,
            sent,
            stoppedReason: insufficientPointsMessage
          };
        }

        if (sendReadyState.type === "timeout") {
          return {
            host: pageHost,
            query,
            requested: count,
            sent,
            stoppedReason: "ポイント送信ボタンが表示されませんでした"
          };
        }

        pressElement(sendReadyState.button);
        sent += 1;

        if (index < count - 1) {
          await wait(delayMs);
        }
      }

      return {
        host: pageHost,
        query,
        requested: count,
        sent
      };
    }
  });

  if (!result?.result) {
    throw new Error("MAIN world のアイテム送信結果を取得できませんでした");
  }

  return result.result;
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

type PointSummaryItem = {
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

export const App = () => {
  const [activeTool, setActiveTool] = useState<Tool>("item-sender");
  const [tab, setTab] = useState<ActiveTab>();
  const [checkboxState, setCheckboxState] = useState<CheckboxState | CheckboxActionResult>();
  const [checkboxRule, setCheckboxRule] = useState<CheckboxRule>({
    autoApply: false,
    action: "check"
  });
  const [itemCandidates, setItemCandidates] = useState<ItemCandidate[]>([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>();
  const [availablePoints, setAvailablePoints] = useState<number>();
  const [pointRecovery, setPointRecovery] = useState<PointRecovery>();
  const [pointStatus, setPointStatus] = useState<PointStatus>();
  const [itemCount, setItemCount] = useState(1);
  const [itemResult, setItemResult] = useState<ItemSendResult>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [pointRecoveryNotificationEnabled, setPointRecoveryNotificationEnabled] = useState(true);

  const refresh = async () => {
    setError(undefined);

    const settings = await getSettings();
    setPointRecoveryNotificationEnabled(settings.pointRecoveryNotificationEnabled);

    const activeTab = await getActiveTab();
    setTab(activeTab);

    if (!activeTab) {
      setCheckboxState(undefined);
      setItemCandidates([]);
      setSelectedItemIndex(undefined);
      setAvailablePoints(undefined);
      setPointRecovery(undefined);
      setPointStatus(undefined);
      return;
    }

    setCheckboxRule(
      settings.checkboxRules[activeTab.host] ?? { autoApply: false, action: "check" }
    );

    try {
      const state = await sendToTab<CheckboxState>(activeTab.id, {
        feature: "checkbox",
        type: "get-state"
      });
      setCheckboxState(state);
    } catch {
      setCheckboxState(undefined);
      setError("このページでは操作できません。ページを再読み込みしてください。");
    }
  };

  useEffect(() => {
    void refresh();
    void resetRecoveryIndicator();
  }, []);

  const loadItemCandidates = async (
    targetTab?: ActiveTab,
    options?: { resetResult?: boolean }
  ) => {
    const currentTab = targetTab ?? tab;

    if (!currentTab) {
      return;
    }

    setBusy(true);
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
      setBusy(false);
    }
  };

  useEffect(() => {
    if (activeTool === "item-sender" && tab) {
      void loadItemCandidates();
    }
  }, [activeTool, tab?.id]);

  const runCheckboxAction = async (action: CheckboxAction) => {
    if (!tab) {
      return;
    }

    setBusy(true);
    setError(undefined);

    try {
      const result = await sendToTab<CheckboxActionResult>(tab.id, {
        feature: "checkbox",
        type: "run",
        action
      });
      setCheckboxState(result);
    } catch {
      setError("チェックボックス操作に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const updateCheckboxRule = async (nextRule: CheckboxRule) => {
    if (!tab) {
      return;
    }

    setCheckboxRule(nextRule);
    await saveCheckboxRule(tab.host, nextRule);

    if (nextRule.autoApply) {
      try {
        const result = await sendToTab<CheckboxActionResult>(tab.id, {
          feature: "checkbox",
          type: "apply-rule"
        });
        setCheckboxState(result);
      } catch {
        setError("自動適用の保存後、現在ページへの反映に失敗しました。");
      }
    }
  };

  const updatePointRecoveryNotificationEnabled = async (enabled: boolean) => {
    setPointRecoveryNotificationEnabled(enabled);
    await savePointRecoveryNotificationEnabled(enabled);
  };

  const sendItem = async () => {
    if (!tab || !selectedItem) {
      return;
    }

    setBusy(true);
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
          delayMs: clampItemSendDelay(ITEM_SEND_DELAY_MS)
        },
        tab.host
      );
      setItemResult(result);
    } catch (error) {
      setError(`アイテム送信操作に失敗しました: ${String(error)}`);
    } finally {
      setBusy(false);
    }

    // 送信で消費したポイント状態を反映し、background の回復検知にも同期する。
    await loadItemCandidates(tab, { resetResult: false });
  };

  const selectedItem = itemCandidates.find((candidate) => candidate.index === selectedItemIndex);
  const maxItemCount = getMaxItemCountFromPoints(availablePoints, selectedItem?.point);
  const pointSummaryItems = getPointSummaryItems(pointStatus, availablePoints, selectedItem?.point);
  const displayPointRecovery = pointStatus?.pointRecovery ?? pointRecovery;
  const checkboxDisabled = !tab || busy;
  const itemDisabled = !tab || busy || selectedItemIndex === undefined;
  const maxItemCountDisabled = !tab || busy || maxItemCount === undefined;

  return (
    <main className="popup-shell">
      <header className="header">
        <span className="brand-mark" aria-hidden="true" />
        <div>
          <h1>TwitCasting Toolkit</h1>
          <p>{tab?.host ?? "TwitCasting ページのみ対応"}</p>
        </div>
      </header>

      <nav className="tabs" aria-label="ツール">
        <button
          type="button"
          className={activeTool === "checkbox" ? "selected" : ""}
          onClick={() => setActiveTool("checkbox")}
        >
          チェック
        </button>
        <button
          type="button"
          className={activeTool === "item-sender" ? "selected" : ""}
          onClick={() => setActiveTool("item-sender")}
        >
          アイテム
        </button>
      </nav>

      {error && <p className="status error">{error}</p>}

      {activeTool === "checkbox" ? (
        <section className="tool-panel" aria-label="チェックボックス一括操作">
          <div className="stats" aria-label="チェックボックス状態">
            <div>
              <span>合計</span>
              <strong>{checkboxState?.total ?? 0}</strong>
            </div>
            <div>
              <span>選択中</span>
              <strong>{checkboxState?.checked ?? 0}</strong>
            </div>
            <div>
              <span>無効</span>
              <strong>{checkboxState?.disabled ?? 0}</strong>
            </div>
          </div>

          <p className="status">{formatCheckboxStatus(checkboxState)}</p>

          <div className="actions" aria-label="一括操作">
            <button type="button" onClick={() => void runCheckboxAction("check")} disabled={checkboxDisabled}>
              全選択
            </button>
            <button
              type="button"
              onClick={() => void runCheckboxAction("uncheck")}
              disabled={checkboxDisabled}
            >
              全解除
            </button>
            <button
              type="button"
              onClick={() => void runCheckboxAction("invert")}
              disabled={checkboxDisabled}
            >
              反転
            </button>
          </div>

          <div className="rule-panel" aria-label="サイト別自動適用">
            <label className="switch-row">
              <span>
                <strong>このホストで自動適用</strong>
                <small>
                  {checkboxRule.action === "check" ? "読み込み時に全選択" : "読み込み時に全解除"}
                </small>
              </span>
              <input
                type="checkbox"
                checked={checkboxRule.autoApply}
                disabled={!tab}
                onChange={(event) =>
                  void updateCheckboxRule({
                    ...checkboxRule,
                    autoApply: event.currentTarget.checked
                  })
                }
              />
            </label>

            <div className="segmented" aria-label="自動適用の動作">
              <button
                type="button"
                className={checkboxRule.action === "check" ? "selected" : ""}
                disabled={!tab}
                onClick={() => void updateCheckboxRule({ ...checkboxRule, action: "check" })}
              >
                選択
              </button>
              <button
                type="button"
                className={checkboxRule.action === "uncheck" ? "selected" : ""}
                disabled={!tab}
                onClick={() => void updateCheckboxRule({ ...checkboxRule, action: "uncheck" })}
              >
                解除
              </button>
            </div>
          </div>
        </section>
      ) : (
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
                      onClick={() => void loadItemCandidates()}
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
                    onClick={() => setSelectedItemIndex(candidate.index)}
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

          <div className="point-summary" aria-label="ポイント情報">
            {pointSummaryItems.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

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
                  void updatePointRecoveryNotificationEnabled(event.currentTarget.checked)
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
                max={20}
                value={itemCount}
                onChange={(event) =>
                  setItemCount((currentCount) =>
                    getNextItemCountFromInput(event.currentTarget.value, currentCount)
                  )
                }
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
            <button type="button" onClick={() => void sendItem()} disabled={itemDisabled}>
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
      )}
    </main>
  );
};
