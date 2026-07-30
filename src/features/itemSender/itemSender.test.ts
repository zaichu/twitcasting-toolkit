import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clampItemSendCount,
  clampItemSendDelay,
  findItemCandidates,
  getElementLabel,
  listItemCandidates,
  normalizeText,
  parseGiftItemCall,
  sendItems
} from "./itemSender";

describe("itemSender", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

  it("builds labels from TwitCasting item DOM", () => {
    document.body.innerHTML = `
      <a href="javascript:giftItem('c:studying777', 'coin', true);" class="tw-item-list-item">
        <img class="tw-item-list-item-icon" src="/img/item_coin.png" alt="コンティニューコイン" />
        <span class="tw-item-list-item-name">コンティニューコイン</span>
        <span class="tw-item-list-item-amount"><img src="/img/icon_point.png" alt="" /> 50</span>
      </a>
    `;

    const item = document.querySelector<HTMLElement>(".tw-item-list-item");

    if (!item) {
      throw new Error("item was not rendered");
    }

    expect(getElementLabel(item)).toBe("コンティニューコイン 50");
  });

  it("does not list sidebar or unrelated interactive elements", async () => {
    document.body.innerHTML = `
      <button>サイドバー</button>
      <a href="/search">検索する</a>
      <div role="button">通知リスト</div>
    `;

    expect(await listItemCandidates()).toMatchObject({
      host: "twitcasting.tv",
      candidates: []
    });
    expect(findItemCandidates("サイドバー")).toHaveLength(0);
  });

  it("lists selectable TwitCasting item candidates without text input", async () => {
    document.body.innerHTML = `
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

    expect(await listItemCandidates()).toMatchObject({
      host: "twitcasting.tv",
      candidates: [
        { index: 0, label: "コンティニューコイン 50" },
        { index: 1, label: "コンティニューコイン爆 250" }
      ]
    });
  });

  it("lists embedded TwitCasting items before the page item list is opened", async () => {
    document.body.innerHTML = `
      <script>
        window.TwScripts.ItemBoxWebUI.initItemBoxWebUI(
          "c:studying777",
          null,
          "https://frontendapi.twitcasting.tv",
          {
            "items": [
              {
                "item_id": "coin",
                "name": "コンティニューコイン",
                "point": 50,
                "image_url": "/img/item_coin.png"
              },
              {
                "item_id": "tea.baku",
                "name": "お茶ｘ10",
                "point": 100,
                "image_url": "/img/item_tea_10.summer.png"
              }
            ],
            "paid_gifts": []
          },
          false,
          false,
          false
        );
      </script>
    `;

    expect(await listItemCandidates()).toMatchObject({
      host: "twitcasting.tv",
      candidates: [
        {
          index: 0,
          label: "コンティニューコイン 50",
          userId: "c:studying777",
          itemId: "coin",
          point: 50,
          imageUrl: "https://twitcasting.tv/img/item_coin.png"
        },
        {
          index: 1,
          label: "お茶ｘ10 100",
          userId: "c:studying777",
          itemId: "tea.baku",
          point: 100,
          imageUrl: "https://twitcasting.tv/img/item_tea_10.summer.png"
        }
      ]
    });
  });

  it("loads the hidden TwitCasting item list from gearajax before falling back to embedded items", async () => {
    document.head.innerHTML = `
      <meta name="tc-page-variables" content="{&quot;broadcaster_id&quot;:&quot;c:studying777&quot;}">
    `;
    document.body.innerHTML = `
      <script>
        window.TwScripts.ItemBoxWebUI.initItemBoxWebUI(
          "c:studying777",
          null,
          "https://frontendapi.twitcasting.tv",
          {
            "items": [
              {
                "item_id": "coin",
                "name": "コンティニューコイン",
                "point": 50,
                "image_url": "/img/item_coin.png"
              }
            ],
            "paid_gifts": []
          },
          false,
          false,
          false
        );
      </script>
    `;
    const fetchMock = vi.fn(async () => {
      return new Response(
        `
          <div class="tw-item-list">
            <a href="javascript:giftItem('c:studying777', 'clap', true);" class="tw-item-list-item">
              <img class="tw-item-list-item-icon" src="/img/item_clap.png" alt="拍手">
              <span class="tw-item-list-item-name">拍手</span>
              <span class="tw-item-list-item-amount">15</span>
            </a>
            <a href="javascript:giftItem('c:studying777', 'coin_baku5', true);" class="tw-item-list-item">
              <img class="tw-item-list-item-icon" src="/img/item_coin_baku5.png" alt="コンティニューコイン爆">
              <span class="tw-item-list-item-name">コンティニューコイン爆</span>
              <span class="tw-item-list-item-amount">250</span>
            </a>
          </div>
        `,
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listItemCandidates()).resolves.toMatchObject({
      host: "twitcasting.tv",
      candidates: [
        {
          index: 0,
          label: "拍手 15",
          userId: "c:studying777",
          itemId: "clap",
          point: 15,
          imageUrl: "https://twitcasting.tv/img/item_clap.png"
        },
        {
          index: 1,
          label: "コンティニューコイン爆 250",
          userId: "c:studying777",
          itemId: "coin_baku5",
          point: 250,
          imageUrl: "https://twitcasting.tv/img/item_coin_baku5.png"
        }
      ]
    });
    expect(fetchMock).toHaveBeenCalledWith("/gearajax.php?c=sendgift&tuser=c%3Astudying777", {
      credentials: "include",
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    });
  });

  it("returns available points from the TwitCasting item window", async () => {
    document.head.innerHTML = `
      <meta name="tc-page-variables" content="{&quot;broadcaster_id&quot;:&quot;c:studying777&quot;}">
    `;
    const fetchMock = vi.fn(async () => {
      return new Response(
        `
          <div id="tw-item-window-data">
            <p class="tw-item-point-status">利用可能ポイント 340 pt</p>
            <div class="tw-item-list">
              <a href="javascript:giftItem('c:studying777', 'coin', true);" class="tw-item-list-item">
                <span class="tw-item-list-item-name">コンティニューコイン</span>
                <span class="tw-item-list-item-amount">50</span>
              </a>
            </div>
          </div>
        `,
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listItemCandidates()).resolves.toMatchObject({
      availablePoints: 340,
      candidates: [
        {
          label: "コンティニューコイン 50",
          point: 50
        }
      ]
    });
  });

  it("returns point recovery from the TwitCasting item window", async () => {
    document.head.innerHTML = `
      <meta name="tc-page-variables" content="{&quot;broadcaster_id&quot;:&quot;c:studying777&quot;}">
    `;
    const fetchMock = vi.fn(async () => {
      return new Response(
        `
          <div id="tw-item-window-data">
            <section>
              <h3>所持中</h3>
              <p>ポイント</p>
              <p>有料ポイント 0 含む</p>
              <p>あと1時間50分で</p>
              <p>132ptに回復</p>
            </section>
            <div class="tw-item-list">
              <a href="javascript:giftItem('c:studying777', 'coin', true);" class="tw-item-list-item">
                <span class="tw-item-list-item-name">コンティニューコイン</span>
                <span class="tw-item-list-item-amount">50</span>
              </a>
            </div>
          </div>
        `,
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listItemCandidates()).resolves.toMatchObject({
      pointRecovery: {
        remainingText: "あと1時間50分で",
        recoveredPoints: 132
      },
      candidates: [
        {
          label: "コンティニューコイン 50",
          point: 50
        }
      ]
    });
  });

  it("keeps available points from gearajax when item candidates fall back to embedded data", async () => {
    document.head.innerHTML = `
      <meta name="tc-page-variables" content="{&quot;broadcaster_id&quot;:&quot;c:studying777&quot;}">
    `;
    document.body.innerHTML = `
      <script>
        window.TwScripts.ItemBoxWebUI.initItemBoxWebUI(
          "c:studying777",
          null,
          "https://frontendapi.twitcasting.tv",
          {
            "items": [
              {
                "item_id": "coin",
                "name": "コンティニューコイン",
                "point": 50,
                "image_url": "/img/item_coin.png"
              }
            ],
            "paid_gifts": []
          },
          false,
          false,
          false
        );
      </script>
    `;
    const fetchMock = vi.fn(async () => {
      return new Response(
        `
          <div id="tw-item-window-data">
            <p class="tw-item-point-status">利用可能ポイント 340 pt</p>
          </div>
        `,
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listItemCandidates()).resolves.toMatchObject({
      availablePoints: 340,
      candidates: [
        {
          label: "コンティニューコイン 50",
          point: 50
        }
      ]
    });
  });

  it("keeps point recovery from gearajax when item candidates fall back to embedded data", async () => {
    document.head.innerHTML = `
      <meta name="tc-page-variables" content="{&quot;broadcaster_id&quot;:&quot;c:studying777&quot;}">
    `;
    document.body.innerHTML = `
      <script>
        window.TwScripts.ItemBoxWebUI.initItemBoxWebUI(
          "c:studying777",
          null,
          "https://frontendapi.twitcasting.tv",
          {
            "items": [
              {
                "item_id": "coin",
                "name": "コンティニューコイン",
                "point": 50,
                "image_url": "/img/item_coin.png"
              }
            ],
            "paid_gifts": []
          },
          false,
          false,
          false
        );
      </script>
    `;
    const fetchMock = vi.fn(async () => {
      return new Response(
        `
          <div id="tw-item-window-data">
            <p>あと1時間50分で</p>
            <p>132ptに回復</p>
          </div>
        `,
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listItemCandidates()).resolves.toMatchObject({
      pointRecovery: {
        remainingText: "あと1時間50分で",
        recoveredPoints: 132
      },
      candidates: [
        {
          label: "コンティニューコイン 50",
          point: 50
        }
      ]
    });
  });

  it("does not use embedded top-level point as available points", async () => {
    document.body.innerHTML = `
      <script>
        window.TwScripts.ItemBoxWebUI.initItemBoxWebUI(
          "c:studying777",
          null,
          "https://frontendapi.twitcasting.tv",
          {
            "point": 132,
            "items": [
              {
                "item_id": "coin",
                "name": "コンティニューコイン",
                "point": 50,
                "image_url": "/img/item_coin.png"
              }
            ],
            "paid_gifts": []
          },
          false,
          false,
          false
        );
      </script>
    `;

    await expect(listItemCandidates()).resolves.toMatchObject({
      availablePoints: undefined,
      candidates: [
        {
          label: "コンティニューコイン 50",
          point: 50
        }
      ]
    });
  });

  it("uses embedded available_point as available points", async () => {
    document.body.innerHTML = `
      <script>
        window.TwScripts.ItemBoxWebUI.initItemBoxWebUI(
          "c:studying777",
          null,
          "https://frontendapi.twitcasting.tv",
          {
            "point": 132,
            "available_point": 32,
            "items": [
              {
                "item_id": "coin",
                "name": "コンティニューコイン",
                "point": 50,
                "image_url": "/img/item_coin.png"
              }
            ],
            "paid_gifts": []
          },
          false,
          false,
          false
        );
      </script>
    `;

    await expect(listItemCandidates()).resolves.toMatchObject({
      availablePoints: 32,
      candidates: [
        {
          label: "コンティニューコイン 50",
          point: 50
        }
      ]
    });
  });

  it("parses TwitCasting giftItem href", () => {
    document.body.innerHTML = `
      <a href="javascript:giftItem('c:studying777', 'coin', true);" class="tw-item-list-item">
        <span class="tw-item-list-item-name">コンティニューコイン</span>
      </a>
    `;
    const item = document.querySelector<HTMLElement>(".tw-item-list-item");

    if (!item) {
      throw new Error("item was not rendered");
    }

    expect(parseGiftItemCall(item)).toEqual({
      userId: "c:studying777",
      itemId: "coin",
      usePoint: true
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
    document.body.innerHTML = `
      <a href="javascript:giftItem('c:studying777', 'tea', true);" class="tw-item-list-item">
        <span class="tw-item-list-item-name">お茶</span>
        <span class="tw-item-list-item-amount">10</span>
      </a>
    `;
    document.querySelector("a")?.addEventListener("click", (event) => {
      event.preventDefault();
      onItemClick();
    });

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
      <a href="javascript:giftItem('c:studying777', 'tea', true);" class="tw-item-list-item">
        <span class="tw-item-list-item-name">お茶</span>
        <span class="tw-item-list-item-amount">10</span>
      </a>
      <a href="javascript:giftItem('c:studying777', 'coin', true);" class="tw-item-list-item">
        <span class="tw-item-list-item-name">コンティニューコイン</span>
        <span class="tw-item-list-item-amount">50</span>
      </a>
    `;
    const [teaButton, coinButton] = Array.from(document.querySelectorAll("a"));
    teaButton.addEventListener("click", onTeaClick);
    coinButton.addEventListener("click", (event) => {
      event.preventDefault();
      onCoinClick();
    });

    const resultPromise = sendItems({
      candidateIndex: 1,
      label: "コンティニューコイン 50",
      count: 2,
      delayMs: 300
    });
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toMatchObject({
      query: "コンティニューコイン 50",
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
    document.body.innerHTML = `
      <a href="javascript:giftItem('c:studying777', 'tea', true);" class="tw-item-list-item">
        <span class="tw-item-list-item-name">お茶</span>
        <span class="tw-item-list-item-amount">10</span>
      </a>
    `;
    document.querySelector("a")?.addEventListener("click", (event) => event.preventDefault());

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
