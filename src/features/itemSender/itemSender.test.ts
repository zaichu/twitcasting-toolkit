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

  it("prefers TwitCasting item list candidates", () => {
    document.body.innerHTML = `
      <button data-item-name="無関係">送る</button>
      <div class="tw-item-list">
        <a href="javascript:giftItem('c:studying777', 'coin', true);" class="tw-item-list-item">
          <div class="tw-item-list-item-icon-container">
            <img class="tw-item-list-item-icon" src="/img/item_coin.png" alt="コンティニューコイン" />
          </div>
          <span class="tw-item-list-item-name">コンティニューコイン</span>
          <span class="tw-item-list-item-amount"><img src="/img/icon_point.png" alt="" /> 50</span>
        </a>
        <a href="javascript:giftItem('c:studying777', 'coin_baku5', true);" class="tw-item-list-item">
          <span class="tw-item-list-item-name">コンティニューコイン爆</span>
          <span class="tw-item-list-item-amount">250</span>
        </a>
      </div>
    `;

    expect(listItemCandidates()).toMatchObject({
      host: "twitcasting.tv",
      candidates: [
        { index: 0, label: "コンティニューコイン 50" },
        { index: 1, label: "コンティニューコイン爆 250" }
      ]
    });
  });

  it("clicks matching candidates with a clamped maximum count", async () => {
    vi.useFakeTimers();
    const onItemClick = vi.fn(() => {
      document.querySelector("#tw-item-window-data")?.remove();
      document.body.insertAdjacentHTML(
        "beforeend",
        `
          <div id="tw-item-window-data">
            <div class="tw-item-send-post" data-sendable="true">
              <form id="gift_form"><button id="messagelink" type="submit">ポイントを使って送る</button></form>
            </div>
          </div>
        `
      );
      document.querySelector("#messagelink")?.addEventListener("click", onSendClick);
    });
    const onSendClick = vi.fn((event: Event) => event.preventDefault());
    document.body.innerHTML = '<button data-item-name="お茶">送る</button>';
    document.querySelector("button")?.addEventListener("click", onItemClick);

    const resultPromise = sendItems({ query: "お茶", count: 25, delayMs: 1 });
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toMatchObject({
      host: "twitcasting.tv",
      query: "お茶",
      requested: 20,
      sent: 20
    });
    expect(onItemClick).toHaveBeenCalledTimes(20);
    expect(onSendClick).toHaveBeenCalledTimes(20);

    vi.useRealTimers();
  });

  it("clicks a selected candidate by index", async () => {
    vi.useFakeTimers();
    const onTeaClick = vi.fn();
    const onCoinClick = vi.fn(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `
          <div id="tw-item-window-data">
            <div class="tw-item-send-post" data-sendable="true">
              <form id="gift_form"><button id="messagelink" type="submit">ポイントを使って送る</button></form>
            </div>
          </div>
        `
      );
      document.querySelector("#messagelink")?.addEventListener("click", onSendClick);
    });
    const onSendClick = vi.fn((event: Event) => event.preventDefault());
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
    expect(onSendClick).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("clicks a selected TwitCasting item anchor", async () => {
    vi.useFakeTimers();
    const onCoinClick = vi.fn((event: Event) => {
      event.preventDefault();
      document.body.insertAdjacentHTML(
        "beforeend",
        `
          <div id="tw-item-window-data">
            <div class="tw-item-send-post" data-sendable="true">
              <form id="gift_form"><button id="messagelink" type="submit">ポイントを使って送る</button></form>
            </div>
          </div>
        `
      );
      document.querySelector("#messagelink")?.addEventListener("click", onSendClick);
    });
    const onSendClick = vi.fn((event: Event) => event.preventDefault());
    document.body.innerHTML = `
      <div class="tw-item-list">
        <a href="javascript:giftItem('c:studying777', 'coin', true);" class="tw-item-list-item">
          <span class="tw-item-list-item-name">コンティニューコイン</span>
          <span class="tw-item-list-item-amount">50</span>
        </a>
      </div>
    `;
    document.querySelector("a")?.addEventListener("click", onCoinClick);

    const resultPromise = sendItems({
      candidateIndex: 0,
      label: "コンティニューコイン 50",
      count: 1,
      delayMs: 300
    });
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toMatchObject({
      query: "コンティニューコイン 50",
      requested: 1,
      sent: 1
    });
    expect(onCoinClick).toHaveBeenCalled();
    expect(onSendClick).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("stops when the point send button is not shown", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<button data-item-name="お茶">送る</button>';

    const resultPromise = sendItems({ query: "お茶", count: 1, delayMs: 300 });
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toMatchObject({
      requested: 1,
      sent: 0,
      stoppedReason: "ポイント送信ボタンが見つかりませんでした"
    });

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
