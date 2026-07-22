import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clampItemSendCount,
  clampItemSendDelay,
  findItemCandidates,
  getElementLabel,
  listItemCandidates,
  normalizeText,
  sendItems
} from "./itemSender";

describe("itemSender", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    window.history.replaceState({}, "", "/example");
  });

  it("normalizes labels and clamps send options", () => {
    expect(normalizeText("  お茶\n  送信  ")).toBe("お茶 送信");
    expect(clampItemSendCount(0)).toBe(1);
    expect(clampItemSendCount(30)).toBe(20);
    expect(clampItemSendDelay(100)).toBe(300);
    expect(clampItemSendDelay(7000)).toBe(5000);
  });

  it("builds labels from common interactive element attributes", () => {
    document.body.innerHTML = `
      <button data-item-name="お茶"><img alt="コンティニューコイン 50" />送る</button>
      <input type="button" value="拍手" aria-label="アイテム" />
    `;

    const [button, input] = Array.from(document.querySelectorAll<HTMLElement>("button, input"));

    expect(getElementLabel(button)).toBe("送る コンティニューコイン 50 お茶");
    expect(getElementLabel(input)).toBe("拍手 アイテム");
  });

  it("finds enabled matching item candidates", () => {
    document.body.innerHTML = `
      <button data-item-name="お茶">送る</button>
      <button disabled>お茶</button>
      <a href="/x" aria-label="拍手">link</a>
      <div role="button" aria-disabled="true">お茶</div>
    `;

    expect(findItemCandidates("お茶")).toHaveLength(1);
    expect(findItemCandidates("拍手")).toHaveLength(1);
    expect(findItemCandidates("お茶")[0]).toMatchObject({ index: 0, label: "送る お茶" });
  });

  it("lists selectable candidates without text input", () => {
    document.body.innerHTML = `
      <button data-item-name="コンティニューコイン 50">送る</button>
      <a href="/x" aria-label="お茶">link</a>
    `;

    expect(listItemCandidates()).toMatchObject({
      host: "twitcasting.tv",
      candidates: [
        { index: 0, label: "送る コンティニューコイン 50" },
        { index: 1, label: "link お茶" }
      ]
    });
  });

  it("clicks matching candidates with a clamped maximum count", async () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    document.body.innerHTML = '<button data-item-name="お茶">送る</button>';
    document.querySelector("button")?.addEventListener("click", onClick);

    const resultPromise = sendItems({ query: "お茶", count: 25, delayMs: 1 });
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toMatchObject({
      host: "twitcasting.tv",
      query: "お茶",
      requested: 20,
      sent: 20
    });
    expect(onClick).toHaveBeenCalledTimes(20);

    vi.useRealTimers();
  });

  it("clicks a selected candidate by index", async () => {
    vi.useFakeTimers();
    const onTeaClick = vi.fn();
    const onCoinClick = vi.fn();
    document.body.innerHTML = `
      <button data-item-name="お茶">送る</button>
      <button data-item-name="コンティニューコイン 50">送る</button>
    `;
    const [teaButton, coinButton] = Array.from(document.querySelectorAll("button"));
    teaButton.addEventListener("click", onTeaClick);
    coinButton.addEventListener("click", onCoinClick);

    const resultPromise = sendItems({
      candidateIndex: 1,
      label: "送る コンティニューコイン 50",
      count: 2,
      delayMs: 300
    });
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toMatchObject({
      query: "送る コンティニューコイン 50",
      requested: 2,
      sent: 2
    });
    expect(onTeaClick).not.toHaveBeenCalled();
    expect(onCoinClick).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("stops when no candidate is found", async () => {
    await expect(sendItems({ query: "お茶", count: 3, delayMs: 300 })).resolves.toMatchObject({
      requested: 3,
      sent: 0,
      stoppedReason: "候補が見つかりませんでした"
    });
  });
});
