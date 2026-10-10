export type CheckboxAction = "check" | "uncheck" | "invert";

export type CheckboxRule = {
  autoApply: boolean;
  action: Exclude<CheckboxAction, "invert">;
};

export type ExtensionSettings = {
  checkboxRules: Record<string, CheckboxRule>;
  pointRecoveryNotificationEnabled: boolean;
};

export type CheckboxState = {
  total: number;
  checked: number;
  disabled: number;
};

export type CheckboxActionResult = CheckboxState & {
  changed: number;
};

export type ItemCandidate = {
  index: number;
  label: string;
  userId?: string;
  itemId?: string;
  point?: number;
  imageUrl?: string;
};

export type PointRecovery = {
  remainingText: string;
  recoveredPoints: number;
};

export type PointStatus = {
  availablePoints?: number;
  ownedPoints?: number;
  paidPoints?: number;
  pointRecovery?: PointRecovery;
};

export type ItemCandidateListResult = {
  candidates: ItemCandidate[];
  pointStatus?: PointStatus;
};

export type ItemSendRequest = {
  userId?: string;
  itemId?: string;
  count: number;
};

export type ItemSendResult = {
  requested: number;
  sent: number;
  stoppedReason?: string;
};

export type ExtensionMessage =
  | {
      feature: "checkbox";
      type: "run";
      action: CheckboxAction;
    }
  | {
      feature: "checkbox";
      type: "get-state";
    }
  | {
      feature: "checkbox";
      type: "apply-rule";
    }
  | {
      feature: "item-sender";
      type: "list";
    };

export const SETTINGS_KEY = "twitCastingToolkitSettings";

export const DEFAULT_SETTINGS: ExtensionSettings = {
  checkboxRules: {},
  pointRecoveryNotificationEnabled: true
};
