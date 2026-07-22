import type { CheckboxAction, CheckboxActionResult, CheckboxState } from "../../extensionTypes";

const getCheckboxes = (): HTMLInputElement[] => {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
};

const emitCheckboxEvents = (checkbox: HTMLInputElement) => {
  checkbox.dispatchEvent(new Event("input", { bubbles: true }));
  checkbox.dispatchEvent(new Event("change", { bubbles: true }));
};

export const getCheckboxState = (): CheckboxState => {
  const checkboxes = getCheckboxes();
  const checked = checkboxes.filter((checkbox) => checkbox.checked).length;
  const disabled = checkboxes.filter((checkbox) => checkbox.disabled).length;

  return {
    url: window.location.href,
    host: window.location.host,
    total: checkboxes.length,
    checked,
    unchecked: checkboxes.length - checked,
    disabled
  };
};

export const setCheckboxValue = (checkbox: HTMLInputElement, checked: boolean): boolean => {
  if (checkbox.disabled || checkbox.checked === checked) {
    return false;
  }

  checkbox.checked = checked;
  emitCheckboxEvents(checkbox);
  return true;
};

export const runCheckboxAction = (action: CheckboxAction): CheckboxActionResult => {
  let changed = 0;

  getCheckboxes().forEach((checkbox) => {
    const nextValue = action === "invert" ? !checkbox.checked : action === "check";
    if (setCheckboxValue(checkbox, nextValue)) {
      changed += 1;
    }
  });

  return {
    ...getCheckboxState(),
    changed
  };
};
