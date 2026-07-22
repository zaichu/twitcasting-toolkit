import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCheckboxState, runCheckboxAction, setCheckboxValue } from "./checkboxTools";

describe("checkboxTools", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    window.history.replaceState({}, "", "/example");
  });

  it("counts checkbox state", () => {
    document.body.innerHTML = `
      <input type="checkbox" checked />
      <input type="checkbox" />
      <input type="checkbox" disabled />
      <input type="text" />
    `;

    expect(getCheckboxState()).toMatchObject({
      host: "twitcasting.tv",
      total: 3,
      checked: 1,
      unchecked: 2,
      disabled: 1
    });
  });

  it("changes enabled checkboxes and emits input/change events", () => {
    document.body.innerHTML = '<input type="checkbox" />';
    const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]');

    if (!checkbox) {
      throw new Error("checkbox was not rendered");
    }

    const onInput = vi.fn();
    const onChange = vi.fn();
    checkbox.addEventListener("input", onInput);
    checkbox.addEventListener("change", onChange);

    expect(setCheckboxValue(checkbox, true)).toBe(true);
    expect(checkbox.checked).toBe(true);
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("does not change disabled checkboxes", () => {
    document.body.innerHTML = '<input type="checkbox" disabled />';
    const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]');

    if (!checkbox) {
      throw new Error("checkbox was not rendered");
    }

    expect(setCheckboxValue(checkbox, true)).toBe(false);
    expect(checkbox.checked).toBe(false);
  });

  it("runs bulk checkbox actions", () => {
    document.body.innerHTML = `
      <input type="checkbox" checked />
      <input type="checkbox" />
      <input type="checkbox" disabled />
    `;

    expect(runCheckboxAction("invert")).toMatchObject({
      total: 3,
      checked: 1,
      unchecked: 2,
      disabled: 1,
      changed: 2
    });

    expect(runCheckboxAction("check")).toMatchObject({
      total: 3,
      checked: 2,
      unchecked: 1,
      disabled: 1,
      changed: 1
    });
  });
});
