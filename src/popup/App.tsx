import { useEffect, useState } from "react";
import {
  CheckboxAction,
  CheckboxActionResult,
  CheckboxRule,
  CheckboxState,
  ExtensionMessage,
  ItemPreviewResult,
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
  return chrome.tabs.sendMessage(tabId, message);
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
  const [itemQuery, setItemQuery] = useState("");
  const [itemCount, setItemCount] = useState(1);
  const [itemDelayMs, setItemDelayMs] = useState(700);
  const [itemPreview, setItemPreview] = useState<ItemPreviewResult>();
  const [itemResult, setItemResult] = useState<ItemSendResult>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setError(undefined);
    const activeTab = await getActiveTab();
    setTab(activeTab);

    if (!activeTab) {
      setCheckboxState(undefined);
      setItemPreview(undefined);
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

  const previewItem = async () => {
    if (!tab || !itemQuery.trim()) {
      return;
    }

    setBusy(true);
    setError(undefined);
    setItemResult(undefined);

    try {
      const result = await sendToTab<ItemPreviewResult>(tab.id, {
        feature: "item-sender",
        type: "preview",
        query: itemQuery
      });
      setItemPreview(result);
    } catch {
      setError("アイテム候補の取得に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const sendItem = async () => {
    if (!tab || !itemQuery.trim()) {
      return;
    }

    const confirmed = window.confirm(
      `${itemQuery} を ${itemCount} 回クリックします。TwitCasting 側の確認画面や消費内容を必ず確認してください。`
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
          query: itemQuery,
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
  const itemDisabled = !tab || busy || !itemQuery.trim();

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
            <span>アイテム名</span>
            <input
              type="text"
              value={itemQuery}
              placeholder="例: お茶"
              onChange={(event) => setItemQuery(event.currentTarget.value)}
            />
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
            <button type="button" onClick={() => void previewItem()} disabled={itemDisabled}>
              候補確認
            </button>
            <button type="button" onClick={() => void sendItem()} disabled={itemDisabled}>
              実行
            </button>
          </div>

          {itemPreview && (
            <div className="candidate-list">
              <strong>候補 {itemPreview.candidates.length} 件</strong>
              {itemPreview.candidates.length === 0 ? (
                <p>一致する操作要素が見つかりません。</p>
              ) : (
                <ul>
                  {itemPreview.candidates.map((candidate) => (
                    <li key={`${candidate.index}-${candidate.label}`}>{candidate.label}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

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
