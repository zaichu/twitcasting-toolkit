import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "./App";
import { SETTINGS_KEY, type ExtensionSettings } from "../extensionTypes";

type ChromeMock = {
  tabs: { query: ReturnType<typeof vi.fn>; sendMessage: ReturnType<typeof vi.fn> };
  scripting: { executeScript: ReturnType<typeof vi.fn> };
  storage: { sync: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> } };
  action: { setBadgeText: ReturnType<typeof vi.fn>; setTitle: ReturnType<typeof vi.fn> };
  runtime: { getManifest: ReturnType<typeof vi.fn> };
};

const TWITCASTING_TAB = { id: 123, url: "https://twitcasting.tv/caster123", active: true };

const CHECKBOX_STATE = {
  url: "https://twitcasting.tv/caster123",
  host: "twitcasting.tv",
  total: 3,
  checked: 1,
  unchecked: 2,
  disabled: 0
};

const CANDIDATE_A = { index: 0, label: "お茶", point: 50 };
const CANDIDATE_B = { index: 1, label: "ケーキ", point: 100 };

const createChromeMock = (): ChromeMock => ({
  tabs: { query: vi.fn(), sendMessage: vi.fn() },
  scripting: { executeScript: vi.fn() },
  storage: { sync: { get: vi.fn(), set: vi.fn() } },
  action: { setBadgeText: vi.fn(), setTitle: vi.fn() },
  runtime: { getManifest: vi.fn() }
});

let chromeMock: ChromeMock;

const setupPopup = (options?: {
  tab?: typeof TWITCASTING_TAB | { id: number; url: string } | null;
  settings?: ExtensionSettings;
  // biome-ignore lint/suspicious/noExplicitAny: テスト用モックの戻り値
  checkboxState?: any;
  // biome-ignore lint/suspicious/noExplicitAny: テスト用モックの戻り値
  listResult?: any;
  listImplementation?: (tabId: number, message: { feature: string; type: string }) => unknown;
  // biome-ignore lint/suspicious/noExplicitAny: テスト用モックの戻り値
  executeScriptResult?: any;
}) => {
  const tab = options?.tab === undefined ? TWITCASTING_TAB : options.tab;
  chromeMock.tabs.query.mockResolvedValue(tab ? [tab] : []);
  chromeMock.storage.sync.get.mockResolvedValue(
    options?.settings ? { [SETTINGS_KEY]: options.settings } : {}
  );
  chromeMock.storage.sync.set.mockResolvedValue(undefined);
  chromeMock.action.setBadgeText.mockResolvedValue(undefined);
  chromeMock.action.setTitle.mockResolvedValue(undefined);
  chromeMock.runtime.getManifest.mockReturnValue({
    action: { default_title: "TwitCasting Toolkit" }
  });
  const listResult = options?.listResult ?? {
    host: "twitcasting.tv",
    candidates: [],
    availablePoints: undefined
  };
  chromeMock.tabs.sendMessage.mockImplementation(async (_tabId, message) => {
    if (options?.listImplementation) {
      return options.listImplementation(
        _tabId as number,
        message as { feature: string; type: string }
      );
    }
    const typed = message as { feature: string; type: string };
    if (typed.feature === "checkbox" && typed.type === "get-state") {
      return options?.checkboxState ?? CHECKBOX_STATE;
    }
    if (typed.feature === "item-sender" && typed.type === "list") {
      return listResult;
    }
    throw new Error(`unexpected message: ${JSON.stringify(message)}`);
  });
  chromeMock.scripting.executeScript.mockResolvedValue(
    options?.executeScriptResult !== undefined
      ? [{ result: options.executeScriptResult }]
      : [{ result: { host: "twitcasting.tv", query: "お茶", requested: 1, sent: 1 } }]
  );
  vi.stubGlobal("chrome", chromeMock as unknown as typeof chrome);
};

beforeEach(() => {
  chromeMock = createChromeMock();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("popup 表示の characterization", () => {
  it("1. TwitCasting以外のページでは対象外表示になり操作ボタンが無効", async () => {
    setupPopup({ tab: { id: 7, url: "https://example.com/live" } });
    render(<App />);

    // ヘッダーに対象外の旨が表示される(読み込み完了を待つ)
    expect(await screen.findByText("TwitCasting ページのみ対応")).toBeInTheDocument();
    // 候補なし表示になり、再試行も実行も押せない
    expect(await screen.findByText("候補がありません")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再試行" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "実行" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "最大" })).toBeDisabled();

    // チェックタブ側の操作ボタンも無効であること
    fireEvent.click(screen.getByRole("button", { name: "チェック" }));
    expect(await screen.findByText("TwitCasting のページを開いてください")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全選択" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "全解除" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "反転" })).toBeDisabled();
  });

  it("2. 候補0件のとき「候補がありません」と再試行が出る", async () => {
    setupPopup({
      listResult: { host: "twitcasting.tv", candidates: [], availablePoints: undefined }
    });
    render(<App />);

    expect(await screen.findByText("0 件の候補を検出")).toBeInTheDocument();
    expect(await screen.findByText("候補がありません")).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "再試行" });
    expect(retry).toBeInTheDocument();
    expect(retry).toBeEnabled();
    expect(await screen.findByText("0 件の候補を検出")).toBeInTheDocument();
  });

  it("3. 候補があるとき一覧表示され先頭が選択状態になる", async () => {
    setupPopup({
      listResult: {
        host: "twitcasting.tv",
        candidates: [CANDIDATE_A, CANDIDATE_B],
        availablePoints: 500
      }
    });
    render(<App />);

    // 読み込み完了(件数表示の更新)を待ってから一覧をassertする
    expect(await screen.findByText("2 件の候補を検出")).toBeInTheDocument();
    const listbox = screen.getByRole("listbox", { name: "アイテム" });
    const first = within(listbox).getByRole("option", { name: /お茶/ });
    const second = within(listbox).getByRole("option", { name: /ケーキ/ });
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(second).toHaveAttribute("aria-selected", "false");

    // 2件目を押すと選択が移る(選択配線が生きていることの裏付け)
    fireEvent.click(second);
    expect(first).toHaveAttribute("aria-selected", "false");
    expect(second).toHaveAttribute("aria-selected", "true");
  });

  it("4a. ポイントサマリーが所有/有料/消費の正しい文言で表示される", async () => {
    setupPopup({
      listResult: {
        host: "twitcasting.tv",
        candidates: [CANDIDATE_A],
        availablePoints: 32,
        pointStatus: { availablePoints: 32, ownedPoints: 2, paidPoints: 0 }
      }
    });
    render(<App />);

    // ポイント反映(読み込み完了)を待ってからサマリーをassertする
    expect(await screen.findByText("2 pt")).toBeInTheDocument();
    const summary = screen.getByLabelText("ポイント情報");
    expect(within(summary).getByText("所有")).toBeInTheDocument();
    expect(within(summary).getByText("2 pt")).toBeInTheDocument();
    expect(within(summary).getByText("有料")).toBeInTheDocument();
    expect(within(summary).getByText("0 pt")).toBeInTheDocument();
    expect(within(summary).getByText("消費")).toBeInTheDocument();
    expect(within(summary).getByText("50 pt/回")).toBeInTheDocument();
  });

  it("4b. 所有ポイント不明時は利用可能/不明/-にフォールバックする", async () => {
    setupPopup({
      listResult: {
        host: "twitcasting.tv",
        candidates: [{ index: 0, label: "ポイントなしアイテム" }],
        availablePoints: 32,
        pointStatus: undefined
      }
    });
    render(<App />);

    // ポイント反映(読み込み完了)を待ってからサマリーをassertする
    expect(await screen.findByText("32 pt")).toBeInTheDocument();
    const summary = screen.getByLabelText("ポイント情報");
    expect(within(summary).getByText("利用可能")).toBeInTheDocument();
    expect(within(summary).getByText("32 pt")).toBeInTheDocument();
    expect(within(summary).getByText("不明")).toBeInTheDocument();
    expect(within(summary).getByText("-")).toBeInTheDocument();
  });

  it("5a. 回復予定がある場合のみ回復文言が表示される", async () => {
    setupPopup({
      listResult: {
        host: "twitcasting.tv",
        candidates: [CANDIDATE_A],
        availablePoints: 100,
        pointRecovery: { remainingText: "あと10分", recoveredPoints: 100 }
      }
    });
    render(<App />);

    const recovery = await screen.findByLabelText("ポイント回復予定");
    expect(recovery).toHaveTextContent("あと10分 100 ptに回復");
  });

  it("5b. 回復予定がない場合は回復文言が表示されない", async () => {
    setupPopup({
      listResult: { host: "twitcasting.tv", candidates: [CANDIDATE_A], availablePoints: 100 }
    });
    render(<App />);

    // 読み込み完了を待ってから「無いこと」をassertする(空振り防止)
    expect(await screen.findByText("1 件の候補を検出")).toBeInTheDocument();
    expect(screen.queryByLabelText("ポイント回復予定")).toBeNull();
  });

  it("5c. pointStatus側の回復予定があればそちらが優先表示される", async () => {
    setupPopup({
      listResult: {
        host: "twitcasting.tv",
        candidates: [CANDIDATE_A],
        availablePoints: 100,
        pointRecovery: { remainingText: "あと10分", recoveredPoints: 100 },
        pointStatus: {
          availablePoints: 100,
          pointRecovery: { remainingText: "あと5分", recoveredPoints: 50 }
        }
      }
    });
    render(<App />);

    const recovery = await screen.findByLabelText("ポイント回復予定");
    expect(recovery).toHaveTextContent("あと5分 50 ptに回復");
  });

  it("6. 通知トグルの初期状態が設定値を反映し切り替えると保存される", async () => {
    setupPopup({
      settings: { checkboxRules: {}, pointRecoveryNotificationEnabled: false },
      listResult: { host: "twitcasting.tv", candidates: [], availablePoints: undefined }
    });
    render(<App />);

    const toggle = (await screen.findByRole("checkbox", {
      name: /無料コイン回復通知/
    })) as HTMLInputElement;
    // 初期状態が設定値(false)を反映している(設定読み込み完了を待つ)
    await waitFor(() => expect(toggle.checked).toBe(false));

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(chromeMock.storage.sync.set).toHaveBeenCalledWith({
        [SETTINGS_KEY]: expect.objectContaining({ pointRecoveryNotificationEnabled: true })
      });
    });
    expect((screen.getByRole("checkbox", { name: /無料コイン回復通知/ }) as HTMLInputElement).checked).toBe(
      true
    );
  });

  // NOTE: 回数入力欄へのキー入力自体は、App.tsx の onChange が
  // setItemCount の updater 内で event.currentTarget を遅延参照しているため、
  // React 19 のテスト環境(act 下)では updater 実行時に event が null 化され
  // TypeError になる。実装に触れない方針のため、キー入力経由のクランプは
  // 既存の純粋関数テスト(getNextItemCountFromInput)に委ね、ここでは
  // 初期値・「最大」ボタン・無効条件という描画結果のみを固定する。
  // 詳細はタスク報告の「気になる点」参照。
  it("7a. 回数の初期値は1で「最大」ボタンで所持ポイントから算出された回数が入る", async () => {
    setupPopup({
      listResult: {
        host: "twitcasting.tv",
        candidates: [CANDIDATE_A],
        availablePoints: 340
      }
    });
    render(<App />);

    expect(await screen.findByText("1 件の候補を検出")).toBeInTheDocument();
    const input = screen.getByLabelText("回数") as HTMLInputElement;
    expect(input.value).toBe("1");

    const maxButton = screen.getByRole("button", { name: "最大" });
    expect(maxButton).toBeEnabled();
    fireEvent.click(maxButton);
    // 340pt / 50pt = 6回
    expect(input.value).toBe("6");
  });

  it("7b. 「最大」で入った回数がそのまま送信回数に反映される", async () => {
    setupPopup({
      listResult: {
        host: "twitcasting.tv",
        candidates: [CANDIDATE_A],
        availablePoints: 340
      }
    });
    // 送信要求の count を結果にそのまま反映させる(要求値の透過確認用)
    chromeMock.scripting.executeScript.mockImplementation(async (options) => {
      const request = (options as { args: [{ count: number }] }).args[0];
      return [
        {
          result: {
            host: "twitcasting.tv",
            query: "お茶",
            requested: request.count,
            sent: request.count
          }
        }
      ];
    });
    render(<App />);

    expect(await screen.findByText("1 件の候補を検出")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "最大" }));
    fireEvent.click(screen.getByRole("button", { name: "実行" }));

    expect(await screen.findByText("6 / 6 回実行")).toBeInTheDocument();
  });

  it("7c. 購入不可のとき「最大」ボタンは無効", async () => {
    setupPopup({
      listResult: {
        host: "twitcasting.tv",
        candidates: [CANDIDATE_A],
        availablePoints: 10
      }
    });
    render(<App />);

    await screen.findByRole("option", { name: /お茶/ });
    expect(screen.getByRole("button", { name: "最大" })).toBeDisabled();
  });

  it("8. 送信実行後ポイント情報が再取得され送信結果メッセージが消えない", async () => {
    let listCalls = 0;
    setupPopup({
      listImplementation: () => {
        listCalls += 1;
        // 初回は340pt、送信後の再取得では290pt(消費反映)を返す
        return {
          host: "twitcasting.tv",
          candidates: [CANDIDATE_A],
          availablePoints: listCalls >= 2 ? 290 : 340
        };
      },
      executeScriptResult: { host: "twitcasting.tv", query: "お茶", requested: 1, sent: 1 }
    });
    render(<App />);

    await screen.findByRole("option", { name: /お茶/ });
    fireEvent.click(screen.getByRole("button", { name: "実行" }));

    // 送信結果メッセージが表示される
    expect(await screen.findByText("1 / 1 回実行")).toBeInTheDocument();

    // 再取得でポイント表示が更新されても結果メッセージは残る
    await waitFor(() => {
      expect(screen.getByText("290 pt")).toBeInTheDocument();
    });
    expect(listCalls).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("1 / 1 回実行")).toBeInTheDocument();
  });
});
