export type CheckboxAction = "check" | "uncheck" | "invert";

export type CheckboxRule = {
  autoApply: boolean;
  action: Exclude<CheckboxAction, "invert">;
};

export type ExtensionSettings = {
  checkboxRules: Record<string, CheckboxRule>;
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
};

export type ItemPreviewResult = {
  host: string;
  query: string;
  candidates: ItemCandidate[];
};

export type ItemSendRequest = {
  query: string;
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
      type: "preview";
      query: string;
    }
  | {
      feature: "item-sender";
      type: "send";
      request: ItemSendRequest;
    };

export const SETTINGS_KEY = "twitCastingToolkitSettings";

export const DEFAULT_SETTINGS: ExtensionSettings = {
  checkboxRules: {}
};
