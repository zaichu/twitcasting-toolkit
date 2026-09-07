import type {
  CheckboxAction,
  CheckboxActionResult,
  CheckboxRule,
  CheckboxState
} from "../../extensionTypes";
import { formatCheckboxStatus, type ActiveTab } from "../popupHelpers";

type CheckboxPanelProps = {
  tab: ActiveTab | undefined;
  checkboxDisabled: boolean;
  checkboxState: CheckboxState | CheckboxActionResult | undefined;
  checkboxRule: CheckboxRule;
  onRunAction: (action: CheckboxAction) => void;
  onUpdateRule: (nextRule: CheckboxRule) => void;
};

export const CheckboxPanel = ({
  tab,
  checkboxDisabled,
  checkboxState,
  checkboxRule,
  onRunAction,
  onUpdateRule
}: CheckboxPanelProps) => {
  return (
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
        <button type="button" onClick={() => onRunAction("check")} disabled={checkboxDisabled}>
          全選択
        </button>
        <button
          type="button"
          onClick={() => onRunAction("uncheck")}
          disabled={checkboxDisabled}
        >
          全解除
        </button>
        <button
          type="button"
          onClick={() => onRunAction("invert")}
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
              onUpdateRule({
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
            onClick={() => onUpdateRule({ ...checkboxRule, action: "check" })}
          >
            選択
          </button>
          <button
            type="button"
            className={checkboxRule.action === "uncheck" ? "selected" : ""}
            disabled={!tab}
            onClick={() => onUpdateRule({ ...checkboxRule, action: "uncheck" })}
          >
            解除
          </button>
        </div>
      </div>
    </section>
  );
};
