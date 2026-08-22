import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const ESM_SYNTAX_PATTERN = /^\s*(import|export)\b/m;

export async function assertNoEsmSyntax(filePath) {
  const source = await readFile(filePath, "utf8");

  if (ESM_SYNTAX_PATTERN.test(source)) {
    throw new Error(
      `${filePath} に import/export 構文が含まれています。content script は classic script として ` +
        "読み込まれるため ESM 構文を含めません。共有モジュールの分割方法を見直してください。",
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const contentScriptPath = join(projectRoot, "dist", "assets", "content.js");

  try {
    await assertNoEsmSyntax(contentScriptPath);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(`OK: ${contentScriptPath} に ESM 構文は含まれていません`);
}
