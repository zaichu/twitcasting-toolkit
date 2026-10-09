import { beforeEach, describe, expect, it, vi } from "vitest";
import { clampItemSendCount, clampItemSendDelay } from "../dom/domUtils";
import {
  getElementLabel,
  listItemCandidates,
  normalizeText,
  parseGiftItemCall
} from "./itemSender";

describe("itemSender", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.head.innerHTML = "";
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
      pointStatus: { availablePoints: 340 },
      candidates: [
        {
          label: "コンティニューコイン 50",
          point: 50
        }
      ]
    });
  });

  it("returns available points from the TwitCasting point purchase heading", async () => {
    document.head.innerHTML = `
      <meta name="tc-page-variables" content="{&quot;broadcaster_id&quot;:&quot;c:studying777&quot;}">
    `;
    const fetchMock = vi.fn(async () => {
      return new Response(
        `
          <div id="tw-item-window-data">
            <div class="tw-item-owned-point">
              <span>32</span>
              <a href="/indexgift.php">ポイント購入</a>
            </div>
            <div class="tw-item-list">
              <a href="javascript:giftItem('c:studying777', 'clap', true);" class="tw-item-list-item">
                <span class="tw-item-list-item-name">拍手</span>
                <span class="tw-item-list-item-amount">15</span>
              </a>
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
      pointStatus: { availablePoints: 32 },
      candidates: [
        {
          label: "拍手 15",
          point: 15
        },
        {
          label: "コンティニューコイン 50",
          point: 50
        }
      ]
    });
  });

  it("prefers the item window when reading fallback point purchase text", async () => {
    document.body.innerHTML = `
      <aside>999 ポイント購入</aside>
      <div id="tw-item-window-data">
        <div class="tw-item-owned-point">
          <span>32</span>
          <a href="/indexgift.php">ポイント購入</a>
        </div>
        <div class="tw-item-list">
          <a href="javascript:giftItem('c:studying777', 'clap', true);" class="tw-item-list-item">
            <span class="tw-item-list-item-name">拍手</span>
            <span class="tw-item-list-item-amount">15</span>
          </a>
        </div>
      </div>
    `;

    await expect(listItemCandidates()).resolves.toMatchObject({
      pointStatus: { availablePoints: 32 },
      candidates: [
        {
          label: "拍手 15",
          point: 15
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
      pointStatus: {
        pointRecovery: {
          remainingText: "あと1時間50分で",
          recoveredPoints: 132
        }
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
      pointStatus: { availablePoints: 340 },
      candidates: [
        {
          label: "コンティニューコイン 50",
          point: 50
        }
      ]
    });
  });

  it("uses gearajax embedded available_point as available points", async () => {
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
            <section>
              <h3>所持中</h3>
              <p>ポイント</p>
              <p>有料ポイント 0 含む</p>
              <p>あと1時間50分で</p>
              <p>132ptに回復</p>
            </section>
            <script>
              window.TwScripts.ItemBoxWebUI.initItemBoxWebUI(
                "c:studying777",
                null,
                "https://frontendapi.twitcasting.tv",
                {
                  "point": 132,
                  "available_point": 32,
                  "items": [],
                  "paid_gifts": []
                },
                false,
                false,
                false
              );
            </script>
          </div>
        `,
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listItemCandidates()).resolves.toMatchObject({
      pointStatus: {
        availablePoints: 32,
        pointRecovery: {
          remainingText: "あと1時間50分で",
          recoveredPoints: 132
        }
      },
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
      pointStatus: {
        pointRecovery: {
          remainingText: "あと1時間50分で",
          recoveredPoints: 132
        }
      },
      candidates: [
        {
          label: "コンティニューコイン 50",
          point: 50
        }
      ]
    });
  });

  it("loads point status from the logged-in user's points page", async () => {
    document.body.innerHTML = `
      <nav class="tw-global-header" data-user-id="zaichu6"></nav>
      <script>
        window.TwScripts.ItemBoxWebUI.initItemBoxWebUI(
          "c:studying777",
          null,
          "https://frontendapi.twitcasting.tv",
          {
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
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/zaichu6/points") {
        return new Response(
          `
            <ul class="tw-point-having-props-display">
              <li>
                <span>
                  <span class="tw-point-having-props-display__name">
                    <span>ポイント</span>
                    <span class="tw-point-having-props-display__desc">
                      <img src="/img/icon_point_paid.png" alt=""> 有料ポイント 0 含む
                    </span>
                  </span>
                  <span class="tw-point-having-props-display__amount">2</span>
                </span>
              </li>
            </ul>
            <div class="tw-paragraph-secondary">
              あと<strong>11時間28分</strong>で<br><strong>102</strong>ptに回復
            </div>
          `,
          { status: 200 }
        );
      }

      return new Response("", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listItemCandidates()).resolves.toMatchObject({
      pointStatus: {
        availablePoints: 32,
        ownedPoints: 2,
        paidPoints: 0,
        pointRecovery: {
          remainingText: "あと11時間28分で",
          recoveredPoints: 102
        }
      },
      candidates: [
        {
          label: "コンティニューコイン 50",
          point: 50
        }
      ]
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/zaichu6/points",
      expect.objectContaining({
        credentials: "include",
        signal: expect.any(AbortSignal)
      })
    );
  });

  it("returns item candidates when the logged-in user's points page times out", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <nav class="tw-global-header" data-user-id="zaichu6"></nav>
      <script>
        window.TwScripts.ItemBoxWebUI.initItemBoxWebUI(
          "c:studying777",
          null,
          "https://frontendapi.twitcasting.tv",
          {
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
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/zaichu6/points") {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => {
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true }
          );
        });
      }

      return Promise.resolve(new Response("", { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const resultPromise = listItemCandidates();

      await vi.advanceTimersByTimeAsync(5000);

      await expect(resultPromise).resolves.toMatchObject({
        pointStatus: {
          availablePoints: 32
        },
        candidates: [
          {
            label: "コンティニューコイン 50",
            point: 50
          }
        ]
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "/zaichu6/points",
        expect.objectContaining({
          credentials: "include",
          signal: expect.any(AbortSignal)
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not load a points page from unrelated data-user-id attributes", async () => {
    document.body.innerHTML = `
      <div class="tw-user-header" data-user-id="streamer"></div>
      <script>
        window.TwScripts.ItemBoxWebUI.initItemBoxWebUI(
          "c:studying777",
          null,
          "https://frontendapi.twitcasting.tv",
          {
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
    const fetchMock = vi.fn(async () => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listItemCandidates()).resolves.toMatchObject({
      pointStatus: {
        availablePoints: 32
      },
      candidates: [
        {
          label: "コンティニューコイン 50",
          point: 50
        }
      ]
    });
    expect(fetchMock).not.toHaveBeenCalledWith("/streamer/points", {
      credentials: "include"
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
      pointStatus: undefined,
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
      pointStatus: { availablePoints: 32 },
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
      itemId: "coin"
    });
  });
});
