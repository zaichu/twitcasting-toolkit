import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertNoEsmSyntax } from "./checkContentScriptBundle.mjs";

describe("assertNoEsmSyntax", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "content-bundle-check-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("does not throw when the bundle has no import/export syntax", async () => {
    const filePath = join(dir, "content.js");
    await writeFile(filePath, `var x=1;function f(){return x}f();`, "utf8");

    await expect(assertNoEsmSyntax(filePath)).resolves.not.toThrow();
  });

  it("throws when the bundle contains an import statement", async () => {
    const filePath = join(dir, "content.js");
    await writeFile(filePath, `import{a}from"./shared.js";a();`, "utf8");

    await expect(assertNoEsmSyntax(filePath)).rejects.toThrow(/import\/export/);
  });

  it("throws when the bundle contains an export statement", async () => {
    const filePath = join(dir, "content.js");
    await writeFile(filePath, `export const a=1;`, "utf8");

    await expect(assertNoEsmSyntax(filePath)).rejects.toThrow(/import\/export/);
  });
});
