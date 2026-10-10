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
  url: string;
  host: string;
  total: number;
  checked: number;
  unchecked: number;
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
  host: string;
  candidates: ItemCandidate[];
  pointStatus?: PointStatus;
};

export type ItemSendRequest = {
  candidateIndex?: number;
  label?: string;
  query?: string;
  userId?: string;
  itemId?: string;
  count: number;
  delayMs: number;
};

export type ItemSendResult = {
  host: string;
  query: string;
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

// メッセージ type ごとの応答型。ExtensionMessage に type を追加したらここにも
// 1行足す(登録漏れは sendToTab の戻り値型でコンパイルエラーになる)。
export type ExtensionMessageResponseMap = {
  "get-state": CheckboxState;
  "run": CheckboxActionResult;
  "apply-rule": CheckboxActionResult;
  "list": ItemCandidateListResult;
};

export const SETTINGS_KEY = "twitCastingToolkitSettings";

export const DEFAULT_SETTINGS: ExtensionSettings = {
  checkboxRules: {},
  pointRecoveryNotificationEnabled: true
};
