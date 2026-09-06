import { useState } from "react";
import { getActiveTab } from "../popupChrome";
import type { ActiveTab } from "../popupHelpers";

export const useActiveTab = () => {
  const [tab, setTab] = useState<ActiveTab>();

  const refreshTab = async (): Promise<ActiveTab | undefined> => {
    const activeTab = await getActiveTab();
    setTab(activeTab);
    return activeTab;
  };

  return { tab, refreshTab };
};
