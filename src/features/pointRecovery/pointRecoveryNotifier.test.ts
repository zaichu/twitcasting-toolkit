import { describe, expect, it } from "vitest";
import {
  didPointRecoveryComplete,
  extractPointRecoveryRemainingText,
  getNextCheckDelayMs,
  hasPendingPointRecoveryInText,
  isPointRecoverySnapshot,
  parseAvailablePointsFromText,
  parsePointRecoverySnapshotFromHtml,
  parseRemainingMillisecondsFromText,
  POINT_RECOVERY_RECHECK_BUFFER_MS,
  stripHtmlToText
} from "./pointRecoveryNotifier";

describe("stripHtmlToText", () => {
  it("タグ・script・styleを除去してテキスト化する", () => {
    const html = `
      <html><head><style>.a{color:red}</style></head>
      <body>
        <script>console.log("x")</script>
        <div>利用可能ポイント <span>1,200</span></div>
      </body></html>
    `;

    expect(stripHtmlToText(html)).toBe("利用可能ポイント 1,200");
  });
});

describe("parseAvailablePointsFromText", () => {
  it("利用可能ポイントの表記から数値を取得する", () => {
    expect(parseAvailablePointsFromText("利用可能ポイント 1,200 pt")).toBe(1200);
  });

  it("該当表記が無ければ undefined を返す", () => {
    expect(parseAvailablePointsFromText("ポイントの表記なし")).toBeUndefined();
  });
});

describe("extractPointRecoveryRemainingText", () => {
  it("回復待ち表記から「あと〜で」部分を取り出す", () => {
    expect(extractPointRecoveryRemainingText("あと5時間20分で100 ptに回復")).toBe("あと5時間20分で");
  });

  it("回復待ち表記が無ければ undefined", () => {
    expect(extractPointRecoveryRemainingText("利用可能ポイント 1,200 pt")).toBeUndefined();
  });
});

describe("hasPendingPointRecoveryInText", () => {
  it("回復待ち表記があれば true", () => {
    expect(hasPendingPointRecoveryInText("あと5時間20分で100 ptに回復")).toBe(true);
  });

  it("回復待ち表記が無ければ false", () => {
    expect(hasPendingPointRecoveryInText("利用可能ポイント 1,200 pt")).toBe(false);
  });
});

describe("parseRemainingMillisecondsFromText", () => {
  it("時間と分から残りミリ秒を計算する", () => {
    expect(parseRemainingMillisecondsFromText("あと1時間50分で")).toBe((1 * 60 * 60 + 50 * 60) * 1000);
  });

  it("タグ除去で数字と単位の間に空白が入っても計算できる", () => {
    expect(parseRemainingMillisecondsFromText("あと 11時間 28分 で")).toBe(
      (11 * 60 * 60 + 28 * 60) * 1000
    );
  });

  it("分のみの表記でも計算できる", () => {
    expect(parseRemainingMillisecondsFromText("あと45分で")).toBe(45 * 60 * 1000);
  });

  it("時間の単位が無ければ undefined", () => {
    expect(parseRemainingMillisecondsFromText("まもなく回復")).toBeUndefined();
  });
});

describe("parsePointRecoverySnapshotFromHtml", () => {
  it("HTML全体からスナップショットを取得する", () => {
    const html = `<div>利用可能ポイント <b>500</b></div><div>あと1時間で600ptに回復</div>`;

    expect(parsePointRecoverySnapshotFromHtml(html)).toEqual({
      availablePoints: 500,
      hasPendingRecovery: true,
      remainingText: "あと1時間で"
    });
  });

  it("実際のマークアップ(数字がタグで囲まれている)でも取得できる", () => {
    const html = `
      <div class="tw-paragraph-secondary">
        あと<strong>11時間28分</strong>で<br><strong>102</strong>ptに回復
      </div>
    `;

    const snapshot = parsePointRecoverySnapshotFromHtml(html);

    expect(snapshot.hasPendingRecovery).toBe(true);
    expect(snapshot.remainingText).toBeDefined();
    expect(parseRemainingMillisecondsFromText(snapshot.remainingText ?? "")).toBe(
      (11 * 60 * 60 + 28 * 60) * 1000
    );
  });
});

describe("isPointRecoverySnapshot", () => {
  it("正しい形なら true", () => {
    expect(isPointRecoverySnapshot({ hasPendingRecovery: true, availablePoints: 10 })).toBe(true);
    expect(isPointRecoverySnapshot({ hasPendingRecovery: false })).toBe(true);
    expect(
      isPointRecoverySnapshot({ hasPendingRecovery: true, remainingText: "あと1時間で" })
    ).toBe(true);
  });

  it("不正な形なら false", () => {
    expect(isPointRecoverySnapshot(undefined)).toBe(false);
    expect(isPointRecoverySnapshot({})).toBe(false);
    expect(isPointRecoverySnapshot({ hasPendingRecovery: "yes" })).toBe(false);
    expect(isPointRecoverySnapshot({ hasPendingRecovery: true, availablePoints: "10" })).toBe(false);
    expect(isPointRecoverySnapshot({ hasPendingRecovery: true, remainingText: 1 })).toBe(false);
  });
});

describe("didPointRecoveryComplete", () => {
  it("前回が undefined の場合は通知しない", () => {
    expect(
      didPointRecoveryComplete(undefined, { hasPendingRecovery: false, availablePoints: 100 })
    ).toBe(false);
  });

  it("回復待ち→解消で true", () => {
    expect(
      didPointRecoveryComplete(
        { hasPendingRecovery: true, availablePoints: 50 },
        { hasPendingRecovery: false, availablePoints: 100 }
      )
    ).toBe(true);
  });

  it("回復待ちが継続中なら false", () => {
    expect(
      didPointRecoveryComplete(
        { hasPendingRecovery: true, availablePoints: 50 },
        { hasPendingRecovery: true, availablePoints: 50 }
      )
    ).toBe(false);
  });

  it("元々回復待ちでなければ false", () => {
    expect(
      didPointRecoveryComplete(
        { hasPendingRecovery: false, availablePoints: 100 },
        { hasPendingRecovery: false, availablePoints: 100 }
      )
    ).toBe(false);
  });

  it("notifyWhenPreviousUnknown指定時、前回 undefined でも満タンなら true", () => {
    expect(
      didPointRecoveryComplete(
        undefined,
        { hasPendingRecovery: false, availablePoints: 100 },
        { notifyWhenPreviousUnknown: true }
      )
    ).toBe(true);
  });

  it("notifyWhenPreviousUnknown指定時、前回 undefined かつ回復待ちなら false", () => {
    expect(
      didPointRecoveryComplete(
        undefined,
        { hasPendingRecovery: true, availablePoints: 50 },
        { notifyWhenPreviousUnknown: true }
      )
    ).toBe(false);
  });
});

describe("getNextCheckDelayMs", () => {
  it("回復待ちで残り時間が判明していれば バッファを加えた ms を返す", () => {
    expect(
      getNextCheckDelayMs({
        hasPendingRecovery: true,
        remainingText: "あと1時間で"
      })
    ).toBe(60 * 60 * 1000 + POINT_RECOVERY_RECHECK_BUFFER_MS);
  });

  it("回復待ちでなければ undefined", () => {
    expect(
      getNextCheckDelayMs({ hasPendingRecovery: false, remainingText: "あと1時間で" })
    ).toBeUndefined();
  });

  it("remainingText が無ければ undefined", () => {
    expect(getNextCheckDelayMs({ hasPendingRecovery: true })).toBeUndefined();
  });

  it("remainingText がパースできなければ undefined", () => {
    expect(
      getNextCheckDelayMs({ hasPendingRecovery: true, remainingText: "まもなく回復" })
    ).toBeUndefined();
  });
});
