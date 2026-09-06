import { describe, expect, it } from "vitest";
import {
  extractPointRecoveryRemainingText,
  hasPendingPointRecoveryInText,
  parseAvailablePointsFromText,
  parsePaidPointsFromText,
  parsePointRecoveryFromText,
  parseRemainingMillisecondsFromText
} from "./pointText";

describe("parseAvailablePointsFromText", () => {
  it("利用可能ポイントの表記から数値を取得する", () => {
    expect(parseAvailablePointsFromText("利用可能ポイント 1,200 pt")).toBe(1200);
  });

  it("保有ポイント・所持ポイントの表記にも対応する", () => {
    expect(parseAvailablePointsFromText("保有ポイント 340 pt")).toBe(340);
    expect(parseAvailablePointsFromText("所持ポイント 2,500")).toBe(2500);
  });

  it("ポイント購入見出しの数値を取得する", () => {
    expect(parseAvailablePointsFromText("32 ポイント購入")).toBe(32);
  });

  it("該当表記が無ければ undefined を返す", () => {
    expect(parseAvailablePointsFromText("ポイントの表記なし")).toBeUndefined();
  });
});

describe("parsePointRecoveryFromText", () => {
  it("実際の表記から残り文言と回復ポイントを取得する", () => {
    expect(parsePointRecoveryFromText("あと1時間50分で132ptに回復")).toEqual({
      remainingText: "あと1時間50分で",
      recoveredPoints: 132
    });
  });

  it("タグ除去で数字と単位の間に空白が入っても取得できる", () => {
    expect(parsePointRecoveryFromText("あと 11時間28分 で 102 ptに回復")).toEqual({
      remainingText: "あと 11時間28分 で",
      recoveredPoints: 102
    });
  });

  it("回復文言が無ければ undefined", () => {
    expect(parsePointRecoveryFromText("利用可能ポイント 1,200 pt")).toBeUndefined();
  });
});

describe("extractPointRecoveryRemainingText / hasPendingPointRecoveryInText", () => {
  it("回復待ち表記から「あと〜で」部分を取り出す", () => {
    expect(extractPointRecoveryRemainingText("あと5時間20分で100 ptに回復")).toBe(
      "あと5時間20分で"
    );
    expect(hasPendingPointRecoveryInText("あと5時間20分で100 ptに回復")).toBe(true);
  });

  it("回復待ち表記が無ければ undefined / false", () => {
    expect(extractPointRecoveryRemainingText("利用可能ポイント 1,200 pt")).toBeUndefined();
    expect(hasPendingPointRecoveryInText("利用可能ポイント 1,200 pt")).toBe(false);
  });
});

describe("parseRemainingMillisecondsFromText", () => {
  it("時間と分から残りミリ秒を計算する", () => {
    expect(parseRemainingMillisecondsFromText("あと1時間50分で")).toBe(
      (1 * 60 * 60 + 50 * 60) * 1000
    );
  });

  it("タグ除去で数字と単位の間に空白が入っても計算できる", () => {
    expect(parseRemainingMillisecondsFromText("あと 11時間 28分 で")).toBe(
      (11 * 60 * 60 + 28 * 60) * 1000
    );
  });

  it("時間の単位が無ければ undefined", () => {
    expect(parseRemainingMillisecondsFromText("まもなく回復")).toBeUndefined();
  });
});

describe("parsePaidPointsFromText", () => {
  it("有料ポイント表記から数値を取得する", () => {
    expect(parsePaidPointsFromText("有料ポイント 0 含む")).toBe(0);
  });

  it("該当表記が無ければ undefined", () => {
    expect(parsePaidPointsFromText("ポイント")).toBeUndefined();
  });
});
