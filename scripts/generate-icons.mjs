import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const svg = readFileSync(resolve(root, "public/icons/icon.svg"), "utf8");

for (const size of [16, 48, 128]) {
  const rendered = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
  }).render();
  writeFileSync(resolve(root, `public/icons/icon-${size}.png`), rendered.asPng());
}
