import { describe, expect, it } from "vitest";
import {
  didPointRecoveryComplete,
  hasPendingPointRecoveryInText,
  isPointRecoverySnapshot,
  parseAvailablePointsFromText,
  parsePointRecoverySnapshotFromHtml,
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

describe("hasPendingPointRecoveryInText", () => {
  it("回復待ち表記があれば true", () => {
    expect(hasPendingPointRecoveryInText("あと5時間20分で100 ptに回復")).toBe(true);
  });

  it("回復待ち表記が無ければ false", () => {
    expect(hasPendingPointRecoveryInText("利用可能ポイント 1,200 pt")).toBe(false);
  });
});

describe("parsePointRecoverySnapshotFromHtml", () => {
  it("HTML全体からスナップショットを取得する", () => {
    const html = `<div>利用可能ポイント <b>500</b></div><div>あと1時間で600ptに回復</div>`;

    expect(parsePointRecoverySnapshotFromHtml(html)).toEqual({
      availablePoints: 500,
      hasPendingRecovery: true
    });
  });
});

describe("isPointRecoverySnapshot", () => {
  it("正しい形なら true", () => {
    expect(isPointRecoverySnapshot({ hasPendingRecovery: true, availablePoints: 10 })).toBe(true);
    expect(isPointRecoverySnapshot({ hasPendingRecovery: false })).toBe(true);
  });

  it("不正な形なら false", () => {
    expect(isPointRecoverySnapshot(undefined)).toBe(false);
    expect(isPointRecoverySnapshot({})).toBe(false);
    expect(isPointRecoverySnapshot({ hasPendingRecovery: "yes" })).toBe(false);
    expect(isPointRecoverySnapshot({ hasPendingRecovery: true, availablePoints: "10" })).toBe(false);
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
});
