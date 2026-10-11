import { createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import yazl from "yazl";
import { assertVersionMatch } from "./checkReleaseVersion.mjs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(projectRoot, "dist");
const manifest = JSON.parse(await readFile(join(distDir, "manifest.json"), "utf8"));
const pkg = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));

try {
  assertVersionMatch(manifest.version, pkg.version);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const outPath = join(
  projectRoot,
  "release",
  `${manifest.name.toLowerCase().replaceAll(/\s+/g, "-")}-${manifest.version}.zip`,
);

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
};

await mkdir(dirname(outPath), { recursive: true });

const files = (await walk(distDir)).sort((a, b) => a.localeCompare(b));
const zip = new yazl.ZipFile();

for (const file of files) {
  const fileStat = await stat(file);
  zip.addFile(file, relative(distDir, file).split(sep).join("/"), {
    mtime: fileStat.mtime,
  });
}
zip.end();

await new Promise((resolvePromise, reject) => {
  const output = createWriteStream(outPath);
  output.on("finish", resolvePromise);
  output.on("error", reject);
  zip.outputStream.on("error", reject);
  zip.outputStream.pipe(output);
});

console.log(`Created ${relative(projectRoot, outPath)}`);
