import { useEffect, useState } from "react";
import { getSettings } from "../storage";
import { resetRecoveryIndicator } from "./popupChrome";
import type { Tool } from "./popupHelpers";
import { useActiveTab } from "./hooks/useActiveTab";
import { useCheckbox } from "./hooks/useCheckbox";
import { useItemSender } from "./hooks/useItemSender";
import { CheckboxPanel } from "./components/CheckboxPanel";
import { ItemSenderPanel } from "./components/ItemSenderPanel";

export const App = () => {
  const [activeTool, setActiveTool] = useState<Tool>("item-sender");
  const [error, setError] = useState<string>();
  const { tab, refreshTab } = useActiveTab();
  const checkbox = useCheckbox({ tab, setError });
  const itemSender = useItemSender({ tab, setError });

  const refresh = async () => {
    setError(undefined);

    const settings = await getSettings();
    itemSender.syncNotificationSetting(settings.pointRecoveryNotificationEnabled);

    const activeTab = await refreshTab();

    if (!activeTab) {
      checkbox.clearCheckboxState();
      itemSender.clearItemState();
      return;
    }

    checkbox.syncRuleFromSettings(settings, activeTab.host);
    await checkbox.loadCheckboxState(activeTab);
  };

  useEffect(() => {
    void refresh();
    void resetRecoveryIndicator();
  }, []);

  useEffect(() => {
    if (activeTool === "item-sender" && tab) {
      void itemSender.loadItemCandidates();
    }
  }, [activeTool, tab?.id]);

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
        <CheckboxPanel
          tab={tab}
          checkboxDisabled={checkbox.checkboxDisabled}
          checkboxState={checkbox.checkboxState}
          checkboxRule={checkbox.checkboxRule}
          onRunAction={(action) => void checkbox.runCheckboxAction(action)}
          onUpdateRule={(nextRule) => void checkbox.updateCheckboxRule(nextRule)}
        />
      ) : (
        <ItemSenderPanel
          tab={tab}
          busy={itemSender.itemSenderBusy}
          itemCandidates={itemSender.itemCandidates}
          selectedItemIndex={itemSender.selectedItemIndex}
          onSelectItem={itemSender.setSelectedItemIndex}
          pointSummaryItems={itemSender.pointSummaryItems}
          displayPointRecovery={itemSender.displayPointRecovery}
          pointRecoveryNotificationEnabled={itemSender.pointRecoveryNotificationEnabled}
          onNotificationChange={(enabled) =>
            void itemSender.updatePointRecoveryNotificationEnabled(enabled)
          }
          itemCount={itemSender.itemCount}
          setItemCount={itemSender.setItemCount}
          maxItemCount={itemSender.maxItemCount}
          maxItemCountDisabled={itemSender.maxItemCountDisabled}
          itemDisabled={itemSender.itemDisabled}
          onSendItem={() => void itemSender.sendItem()}
          onLoadCandidates={() => void itemSender.loadItemCandidates()}
          itemResult={itemSender.itemResult}
        />
      )}
    </main>
  );
};
