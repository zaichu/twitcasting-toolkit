import { useEffect, useState } from "react";
import {
  CheckboxAction,
  CheckboxActionResult,
  CheckboxRule,
  CheckboxState,
  ExtensionMessage,
  ItemCandidate,
  ItemCandidateListResult,
  ItemSendResult
} from "../extensionTypes";
import { getSettings, saveCheckboxRule } from "../storage";

type ActiveTab = {
  id: number;
  url: string;
  host: string;
};

type Tool = "checkbox" | "item-sender";

const twitCastingUrlPattern = /^https:\/\/([^.]+\.)?twitcasting\.tv\//;

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

export const App = () => {
  const [activeTool, setActiveTool] = useState<Tool>("checkbox");
  const [tab, setTab] = useState<ActiveTab>();
  const [checkboxState, setCheckboxState] = useState<CheckboxState | CheckboxActionResult>();
  const [checkboxRule, setCheckboxRule] = useState<CheckboxRule>({
    autoApply: false,
    action: "check"
  });
  const [itemCandidates, setItemCandidates] = useState<ItemCandidate[]>([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>();
  const [itemCount, setItemCount] = useState(1);
  const [itemDelayMs, setItemDelayMs] = useState(700);
  const [itemResult, setItemResult] = useState<ItemSendResult>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setError(undefined);
    const activeTab = await getActiveTab();
    setTab(activeTab);

    if (!activeTab) {
      setCheckboxState(undefined);
      setItemCandidates([]);
      setSelectedItemIndex(undefined);
      return;
    }

    const settings = await getSettings();
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
  }, []);

  const loadItemCandidates = async () => {
    if (!tab) {
      return;
    }

    setBusy(true);
    setError(undefined);
    setItemResult(undefined);

    try {
      const result = await sendToTab<ItemCandidateListResult>(tab.id, {
        feature: "item-sender",
        type: "list"
      });
      setItemCandidates(result.candidates);
      setSelectedItemIndex((currentIndex) => {
        if (result.candidates.some((candidate) => candidate.index === currentIndex)) {
          return currentIndex;
        }

        return result.candidates[0]?.index;
      });
    } catch (error) {
      setItemCandidates([]);
      setSelectedItemIndex(undefined);
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

  const sendItem = async () => {
    const selectedItem = itemCandidates.find((candidate) => candidate.index === selectedItemIndex);

    if (!tab || !selectedItem) {
      return;
    }

    const confirmed = window.confirm(
      `${selectedItem.label} を ${itemCount} 回クリックします。TwitCasting 側の確認画面や消費内容を必ず確認してください。`
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setError(undefined);
    setItemResult(undefined);

    try {
      const result = await sendToTab<ItemSendResult>(tab.id, {
        feature: "item-sender",
        type: "send",
        request: {
          candidateIndex: selectedItem.index,
          label: selectedItem.label,
          userId: selectedItem.userId,
          itemId: selectedItem.itemId,
          count: itemCount,
          delayMs: itemDelayMs
        }
      });
      setItemResult(result);
    } catch {
      setError("アイテム送信操作に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const checkboxDisabled = !tab || busy;
  const itemDisabled = !tab || busy || selectedItemIndex === undefined;

  return (
    <main className="popup-shell">
      <header className="header">
        <div>
          <h1>TwitCasting Toolkit</h1>
          <p>{tab?.host ?? "TwitCasting ページのみ対応"}</p>
        </div>
        <button className="icon-button" type="button" onClick={refresh} disabled={busy}>
          更新
        </button>
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
          <label className="field">
            <span>アイテム</span>
            <select
              value={selectedItemIndex ?? ""}
              disabled={!tab || busy || itemCandidates.length === 0}
              onChange={(event) => setSelectedItemIndex(Number(event.currentTarget.value))}
            >
              {itemCandidates.length === 0 ? (
                <option value="">候補がありません</option>
              ) : (
                itemCandidates.map((candidate) => (
                  <option key={`${candidate.index}-${candidate.label}`} value={candidate.index}>
                    {candidate.label}
                  </option>
                ))
              )}
            </select>
          </label>

          <div className="field-grid">
            <label className="field">
              <span>回数</span>
              <input
                type="number"
                min={1}
                max={20}
                value={itemCount}
                onChange={(event) => setItemCount(Number(event.currentTarget.value))}
              />
            </label>
            <label className="field">
              <span>間隔 ms</span>
              <input
                type="number"
                min={300}
                max={5000}
                step={100}
                value={itemDelayMs}
                onChange={(event) => setItemDelayMs(Number(event.currentTarget.value))}
              />
            </label>
          </div>

          <div className="actions two">
            <button type="button" onClick={() => void loadItemCandidates()} disabled={!tab || busy}>
              再取得
            </button>
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
