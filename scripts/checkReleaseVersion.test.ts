import { describe, expect, it } from "vitest";
import { assertVersionMatch } from "./checkReleaseVersion.mjs";

describe("assertVersionMatch", () => {
  it("does not throw when versions match", () => {
    expect(() => assertVersionMatch("2.0.1", "2.0.1")).not.toThrow();
  });

  it("throws when versions differ", () => {
    expect(() => assertVersionMatch("2.0.0", "2.0.1")).toThrow(/Version mismatch/);
  });
});
