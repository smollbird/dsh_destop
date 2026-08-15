"use strict";
/**
 * make-icon.js —— 生成 dsh-desktop 应用图标。
 *
 * 构图：DeepSeek 蓝圆角方块 + 官方 DSH 白色 logo。
 * 输出：
 *   assets/dsh-desktop.ico            多尺寸 PNG 条目 ICO（16/24/32/48/64/128/256，Windows）
 *   assets/icons/*.png                各尺寸 PNG（16..1024）
 *   assets/DeepSeek Harness.iconset/  macOS iconset（iconutil 可直接转 .icns）
 *   assets/DeepSeek Harness.icns      macOS .icns（安装了 png2icons 时生成）
 *
 * 依赖 sharp（用于 SVG 光栅化）。按顺序从以下位置解析：
 *   1. 本项目的 node_modules
 *   2. $DSH_HOME/profiles/node_modules（dsh 完整安装自带 sharp）
 *   3. npm 全局 / npx 缓存中的 dsh 安装
 */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createRequire } = require("node:module");

const ROOT = path.resolve(__dirname, "..");
const LOGO_SVG = path.join(ROOT, "assets", "dsh-logo.svg");
const OUT_ICO = path.join(ROOT, "assets", "dsh-desktop.ico");
const OUT_DIR = path.join(ROOT, "assets", "icons");
const OUT_ICONSET_DIR = path.join(ROOT, "assets", "DeepSeek Harness.iconset");
const OUT_ICNS = path.join(ROOT, "assets", "DeepSeek Harness.icns");
const SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const ICONSET_FILES = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024],
];
const BG = "#4d6bfe"; // DeepSeek 品牌蓝
const PAD = 0.14;     // logo 占画布比例

function loadSharp() {
  const candidates = [
    path.join(ROOT, "node_modules", "sharp"),
    path.join(os.homedir(), ".dsh", "profiles", "node_modules", "sharp"),
    path.join(
      os.homedir(),
      "AppData",
      "Local",
      "npm-cache",
      "_npx",
      "1e7f6d9597241db0",
      "node_modules",
      "sharp"
    ),
  ];
  for (const dir of candidates) {
    const pkgFile = path.join(dir, "package.json");
    try {
      if (!fs.existsSync(pkgFile)) continue;
      const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
      const main = path.join(dir, pkg.main || "lib/index.js");
      if (!fs.existsSync(main)) continue;
      const req = createRequire(main);
      return req(main); // sharp 为 CommonJS
    } catch (err) {
      console.warn(`[make-icon] sharp candidate failed: ${dir} (${err.message})`);
    }
  }
  throw new Error("未找到 sharp：请 `npm i -D sharp` 或确保 dsh 已安装（含 sharp）");
}

function buildMasterSvg(logoPathData) {
  const size = 512;
  const logoBox = size * (1 - PAD * 2); // 368.64
  const scale = logoBox / 50;
  const offset = (size - logoBox) / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" rx="115" fill="${BG}"/>` +
    `<g transform="translate(${offset} ${offset}) scale(${scale})">` +
    `<path d="${logoPathData}" fill="#ffffff" fill-opacity="1" fill-rule="nonzero"/>` +
    `</g></svg>`
  );
}

function extractPath(svgText) {
  const m = svgText.match(/<path\s+d="([^"]+)"/);
  if (!m) throw new Error("dsh-logo.svg 中未找到 <path d=...>");
  return m[1];
}

function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 => 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette count
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

async function main() {
  const sharp = loadSharp();
  const logo = extractPath(fs.readFileSync(LOGO_SVG, "utf8"));
  const master = await sharp(Buffer.from(buildMasterSvg(logo)))
    .png()
    .toBuffer();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const pngBySize = new Map();
  for (const size of SIZES) {
    const data = await sharp(master).resize(size, size).png().toBuffer();
    pngBySize.set(size, data);
    fs.writeFileSync(path.join(OUT_DIR, `icon-${size}.png`), data);
    console.log(`[make-icon] assets/icons/icon-${size}.png`);
  }
  fs.writeFileSync(
    OUT_ICO,
    buildIco(ICO_SIZES.map((size) => ({ size, data: pngBySize.get(size) })))
  );
  console.log(`[make-icon] ${OUT_ICO} (${ICO_SIZES.join("/")})`);

  // macOS .iconset
  fs.mkdirSync(OUT_ICONSET_DIR, { recursive: true });
  for (const [name, size] of ICONSET_FILES) {
    fs.writeFileSync(path.join(OUT_ICONSET_DIR, name), pngBySize.get(size));
  }
  console.log(`[make-icon] ${OUT_ICONSET_DIR} (${ICONSET_FILES.length} files)`);

  // macOS .icns（可选：需要 png2icons）
  try {
    const png2icons = require("png2icons");
    const icns = png2icons.createICNS(pngBySize.get(1024), png2icons.BICUBIC, 0);
    if (icns) {
      fs.writeFileSync(OUT_ICNS, icns);
      console.log(`[make-icon] ${OUT_ICNS} (png2icons)`);
    } else {
      console.warn("[make-icon] png2icons.createICNS returned null, skip .icns");
    }
  } catch {
    console.warn("[make-icon] png2icons 未安装，跳过 .icns（macOS 上可运行 `npm i -D png2icons` 后重新生成）");
  }
}

main().catch((err) => {
  console.error("[make-icon] failed:", err);
  process.exit(1);
});
