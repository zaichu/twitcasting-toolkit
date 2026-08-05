import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const scale = 4;

const hex = (value) => {
  const normalized = value.replace("#", "");

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
};

const mix = (from, to, t) => {
  return from.map((channel, index) => Math.round(channel + (to[index] - channel) * t));
};

const blend = (base, over, alpha) => {
  return base.map((channel, index) => Math.round(channel * (1 - alpha) + over[index] * alpha));
};

const crcTable = Array.from({ length: 256 }, (_, index) => {
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

const chunk = (type, data) => {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  const payload = Buffer.concat([typeBuffer, data]);

  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(payload));

  return Buffer.concat([length, payload, crc]);
};

const writePng = (path, width, height, rgb) => {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  const raw = Buffer.alloc((width * 3 + 1) * height);

  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0;
    rgb.copy(raw, rowStart + 1, y * width * 3, (y + 1) * width * 3);
  }

  writeFileSync(
    path,
    Buffer.concat([
      header,
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0))
    ])
  );
};

const roundedRectAlpha = (x, y, rectX, rectY, width, height, radius) => {
  const dx = Math.max(rectX - x, 0, x - (rectX + width));
  const dy = Math.max(rectY - y, 0, y - (rectY + height));
  const insideBox = x >= rectX && x <= rectX + width && y >= rectY && y <= rectY + height;

  if (!insideBox) {
    return 0;
  }

  const cornerX = x < rectX + radius ? rectX + radius : x > rectX + width - radius ? rectX + width - radius : x;
  const cornerY = y < rectY + radius ? rectY + radius : y > rectY + height - radius ? rectY + height - radius : y;
  const distance = Math.hypot(x - cornerX, y - cornerY) - radius;

  return Math.max(0, Math.min(1, 0.8 - Math.max(distance, Math.hypot(dx, dy))));
};

const segmentDistance = (x, y, ax, ay, bx, by) => {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * abx + (y - ay) * aby) / (abx * abx + aby * aby)));
  const px = ax + abx * t;
  const py = ay + aby * t;

  return Math.hypot(x - px, y - py);
};

const strokeAlpha = (x, y, points, radius) => {
  let distance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    distance = Math.min(distance, segmentDistance(x, y, current[0], current[1], next[0], next[1]));
  }

  return Math.max(0, Math.min(1, radius + 0.6 - distance));
};

const sampleIcon = (x, y) => {
  let color = hex("#0c1f2a");

  const baseAlpha = roundedRectAlpha(x, y, 12, 12, 104, 104, 13);
  if (baseAlpha > 0) {
    const t = Math.min(1, Math.max(0, (x + y - 28) / 196));
    const first = mix(hex("#102a38"), hex("#117c73"), Math.min(1, t * 1.45));
    const base = mix(first, hex("#0b4f5f"), Math.max(0, (t - 0.62) / 0.38));
    color = blend(color, base, baseAlpha);
  }

  const panelShadow = roundedRectAlpha(x, y, 24, 29, 80, 74, 10);
  if (panelShadow > 0) {
    color = blend(color, hex("#062c34"), panelShadow * 0.28);
  }

  const panelAlpha = roundedRectAlpha(x, y, 31, 28, 71, 73, 10);
  if (panelAlpha > 0) {
    const panel = mix(hex("#f8fffb"), hex("#dff7ef"), Math.min(1, (y - 32) / 62));
    color = blend(color, panel, panelAlpha);
  }

  const bubbleAlpha = roundedRectAlpha(x, y, 39, 44, 55, 38, 8);
  if (bubbleAlpha > 0) {
    color = blend(color, hex("#ffffff"), bubbleAlpha);
  }

  if (x >= 55 && x <= 72 && y >= 78 && y <= 94 && y >= -0.72 * (x - 55) + 88) {
    color = blend(color, hex("#ffffff"), 1);
  }

  const checkAlpha = strokeAlpha(
    x,
    y,
    [
      [54, 61.5],
      [64.5, 76],
      [87, 53]
    ],
    5
  );
  if (checkAlpha > 0) {
    color = blend(color, hex("#0d8478"), checkAlpha);
  }

  const sparkleAlpha = Math.max(
    strokeAlpha(x, y, [[96, 24], [96, 36]], 3),
    strokeAlpha(x, y, [[90, 30], [102, 30]], 3)
  );
  if (sparkleAlpha > 0) {
    color = blend(color, hex("#ffb43f"), sparkleAlpha);
  }

  const coral = Math.max(0, Math.min(1, 5.8 - Math.hypot(x - 29, y - 104)));
  if (coral > 0) {
    color = blend(color, hex("#ff6f4b"), coral);
  }

  const amber = Math.max(0, Math.min(1, 4.8 - Math.hypot(x - 101, y - 101)));
  if (amber > 0) {
    color = blend(color, hex("#ffb43f"), amber);
  }

  return color;
};

const renderIcon = (size) => {
  const width = size * scale;
  const height = size * scale;
  const highRes = Buffer.alloc(width * height * 3);
  const output = Buffer.alloc(size * size * 3);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = sampleIcon(((x + 0.5) / width) * 128, ((y + 0.5) / height) * 128);
      const offset = (y * width + x) * 3;
      highRes[offset] = r;
      highRes[offset + 1] = g;
      highRes[offset + 2] = b;
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const total = [0, 0, 0];

      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const offset = ((y * scale + sy) * width + x * scale + sx) * 3;
          total[0] += highRes[offset];
          total[1] += highRes[offset + 1];
          total[2] += highRes[offset + 2];
        }
      }

      const offset = (y * size + x) * 3;
      output[offset] = Math.round(total[0] / (scale * scale));
      output[offset + 1] = Math.round(total[1] / (scale * scale));
      output[offset + 2] = Math.round(total[2] / (scale * scale));
    }
  }

  writePng(resolve(root, `public/icons/icon-${size}.png`), size, size, output);
};

[16, 48, 128].forEach(renderIcon);
