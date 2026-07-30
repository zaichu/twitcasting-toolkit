import { createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";
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

const dateToDosTime = (date) => {
  const year = Math.max(date.getFullYear(), 1980);
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
};

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

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

const writeUInt16 = (value) => {
  const buffer = Buffer.allocUnsafe(2);
  buffer.writeUInt16LE(value);
  return buffer;
};

const writeUInt32 = (value) => {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeUInt32LE(value);
  return buffer;
};

await mkdir(dirname(outPath), { recursive: true });

const output = createWriteStream(outPath);
let offset = 0;
const centralDirectory = [];

const write = (buffer) => {
  output.write(buffer);
  offset += buffer.length;
};

const files = (await walk(distDir)).sort((a, b) => a.localeCompare(b));

for (const file of files) {
  const source = await readFile(file);
  const compressed = deflateRawSync(source, { level: 9 });
  const checksum = crc32(source);
  const fileStat = await stat(file);
  const { time, date } = dateToDosTime(fileStat.mtime);
  const name = Buffer.from(relative(distDir, file).split(sep).join("/"));
  const localOffset = offset;

  write(
    Buffer.concat([
      writeUInt32(0x04034b50),
      writeUInt16(20),
      writeUInt16(0x0800),
      writeUInt16(8),
      writeUInt16(time),
      writeUInt16(date),
      writeUInt32(checksum),
      writeUInt32(compressed.length),
      writeUInt32(source.length),
      writeUInt16(name.length),
      writeUInt16(0),
      name,
      compressed,
    ]),
  );

  centralDirectory.push(
    Buffer.concat([
      writeUInt32(0x02014b50),
      writeUInt16(20),
      writeUInt16(20),
      writeUInt16(0x0800),
      writeUInt16(8),
      writeUInt16(time),
      writeUInt16(date),
      writeUInt32(checksum),
      writeUInt32(compressed.length),
      writeUInt32(source.length),
      writeUInt16(name.length),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(localOffset),
      name,
    ]),
  );
}

const centralDirectoryOffset = offset;
for (const entry of centralDirectory) {
  write(entry);
}
const centralDirectorySize = offset - centralDirectoryOffset;

write(
  Buffer.concat([
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(centralDirectory.length),
    writeUInt16(centralDirectory.length),
    writeUInt32(centralDirectorySize),
    writeUInt32(centralDirectoryOffset),
    writeUInt16(0),
  ]),
);

await new Promise((resolve, reject) => {
  output.end(resolve);
  output.on("error", reject);
});

console.log(`Created ${relative(projectRoot, outPath)}`);
