import { CheckboxRule, DEFAULT_SETTINGS, ExtensionSettings, SETTINGS_KEY } from "./extensionTypes";

const isCheckboxRule = (value: unknown): value is CheckboxRule => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const rule = value as Partial<CheckboxRule>;
  return (
    typeof rule.autoApply === "boolean" &&
    (rule.action === "check" || rule.action === "uncheck")
  );
};

export const normalizeSettings = (value: unknown): ExtensionSettings => {
  if (!value || typeof value !== "object") {
    return DEFAULT_SETTINGS;
  }

  const rawSettings = value as Partial<ExtensionSettings>;
  const rawCheckboxRules =
    rawSettings.checkboxRules && typeof rawSettings.checkboxRules === "object"
      ? rawSettings.checkboxRules
      : {};

  const checkboxRules = Object.fromEntries(
    Object.entries(rawCheckboxRules).filter(([, rule]) => isCheckboxRule(rule))
  );

  const pointRecoveryNotificationEnabled =
    typeof rawSettings.pointRecoveryNotificationEnabled === "boolean"
      ? rawSettings.pointRecoveryNotificationEnabled
      : DEFAULT_SETTINGS.pointRecoveryNotificationEnabled;

  return { checkboxRules, pointRecoveryNotificationEnabled };
};

export const getSettings = async (): Promise<ExtensionSettings> => {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  return normalizeSettings(stored[SETTINGS_KEY]);
};

export const saveSettings = (settings: ExtensionSettings): Promise<void> => {
  return chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
};

export const getCheckboxRule = async (host: string): Promise<CheckboxRule | undefined> => {
  const settings = await getSettings();
  return settings.checkboxRules[host];
};

export const saveCheckboxRule = async (
  host: string,
  rule: CheckboxRule
): Promise<ExtensionSettings> => {
  const settings = await getSettings();
  const nextSettings = {
    ...settings,
    checkboxRules: {
      ...settings.checkboxRules,
      [host]: rule
    }
  };

  await saveSettings(nextSettings);
  return nextSettings;
};

export const savePointRecoveryNotificationEnabled = async (
  enabled: boolean
): Promise<ExtensionSettings> => {
  const settings = await getSettings();
  const nextSettings = { ...settings, pointRecoveryNotificationEnabled: enabled };

  await saveSettings(nextSettings);
  return nextSettings;
};
