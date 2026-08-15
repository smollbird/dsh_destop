/**
 * make-iconfont.mjs — 生成 @文件 候选菜单的图标字体。
 *
 * 图标复制自内核设计系统 @deepseek-ai/dsh-client-ui-primitives（ic_ds_* 集，
 * 同 figma 源）：
 *   - U+E001 文件夹 = IconFolderClose16（fill none，path 带 translate(1.5 2.429)）
 *   - U+E002 回形针 = IconPaperclipOutline16
 *
 * 输出 src/iconfont.ts（TTF base64，与官方 DshChipCell 内嵌字体同款模式），
 * 产物提交进仓库——日常构建无需本脚本依赖。
 *
 * 重新生成需要：cd /tmp/iconfont-build && npm i svg2ttf（svgpath 是其依赖）
 * 然后：node scripts/make-iconfont.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const require = createRequire(import.meta.url);
const FONT_BUILD = process.env.ICONFONT_BUILD_DIR ?? "/tmp/iconfont-build";
const svg2ttf = require(path.join(FONT_BUILD, "node_modules", "svg2ttf"));
const svgpath = require(path.join(FONT_BUILD, "node_modules", "svgpath"));

/* 内核 IconFolderClose16（16×16，path 带 transform） */
const FOLDER_PATH = "M5.05582 0.518756L4.50669 0.86654L5.05582 0.518756ZM13 9.4837L13.65 9.4837L13.65 3.53962L13 3.53962L12.35 3.53962L12.35 9.4837L13 9.4837ZM11.3264 1.86603L11.3264 1.21603L6.52313 1.21603L6.52313 1.86603L6.52313 2.51603L11.3264 2.51603L11.3264 1.86603ZM5.58054 1.34727L6.12968 0.999489L5.60495 0.170972L5.05582 0.518756L4.50669 0.86654L5.03141 1.69506L5.58054 1.34727ZM4.11323 1.23058e-13L4.11323 -0.65L1.67359 -0.65L1.67359 5.00699e-14L1.67359 0.65L4.11323 0.65L4.11323 1.23058e-13ZM0 1.67359L-0.65 1.67359L-0.65 9.4837L0 9.4837L0.65 9.4837L0.65 1.67359L0 1.67359ZM11.3264 11.1573L11.3264 10.5073L1.67359 10.5073L1.67359 11.1573L1.67359 11.8073L11.3264 11.8073L11.3264 11.1573ZM0 9.4837L-0.65 9.4837C-0.65 10.767 0.390308 11.8073 1.67359 11.8073L1.67359 11.1573L1.67359 10.5073C1.10828 10.5073 0.65 10.049 0.65 9.4837L0 9.4837ZM1.67359 5.00699e-14L1.67359 -0.65C0.390307 -0.65 -0.65 0.390309 -0.65 1.67359L0 1.67359L0.65 1.67359C0.65 1.10828 1.10828 0.65 1.67359 0.65L1.67359 5.00699e-14ZM5.05582 0.518756L5.60495 0.170972C5.28121 -0.340193 4.71829 -0.65 4.11323 -0.65L4.11323 1.23058e-13L4.11323 0.65C4.27282 0.65 4.4213 0.731715 4.50669 0.86654L5.05582 0.518756ZM6.52313 1.86603L6.52313 1.21603C6.36354 1.21603 6.21507 1.13431 6.12968 0.999489L5.58054 1.34727L5.03141 1.69506C5.35515 2.20622 5.91808 2.51603 6.52313 2.51603L6.52313 1.86603ZM13 3.53962L13.65 3.53962C13.65 2.25634 12.6097 1.21603 11.3264 1.21603L11.3264 1.86603L11.3264 2.51603C11.8917 2.51603 12.35 2.97431 12.35 3.53962L13 3.53962ZM13 9.4837L12.35 9.4837C12.35 10.049 11.8917 10.5073 11.3264 10.5073L11.3264 11.1573L11.3264 11.8073C12.6097 11.8073 13.65 10.767 13.65 9.4837L13 9.4837ZM0 0L-0.65 0C-0.65 1.28329 0.390308 2.3236 1.67359 2.3236L1.67359 1.67359L1.67359 1.0236C1.10828 1.0236 0.65 0.565313 0.65 0L0 0ZM4.11323 1.23058e-13L4.11323 -0.65C2.82994 -0.65 1.78963 0.390309 1.78963 1.67359L2.43963 1.67359L3.08963 1.67359C3.08963 1.10828 3.54791 0.65 4.11323 0.65L4.11323 1.23058e-13Z";
const FOLDER_TRANSFORM = { tx: 1.5, ty: 2.429 };

/* 内核 IconPaperclipOutline16 */
const CLIP_PATH = "M5.5498 9.75V5H6.9502V9.75C6.9502 10.3299 7.4201 10.7998 8 10.7998C8.5799 10.7998 9.0498 10.3299 9.0498 9.75V4.5C9.0498 2.9536 7.7964 1.7002 6.25 1.7002C4.7036 1.7002 3.4502 2.9536 3.4502 4.5V9.75C3.4502 12.2629 5.4871 14.2998 8 14.2998C10.5129 14.2998 12.5498 12.2629 12.5498 9.75V4C12.5498 2.067 10.9828 0.5 9.0498 0.5C7.1168 0.5 5.5498 2.067 5.5498 4V9.75C5.5498 10.9926 6.5072 11.95 7.7498 11.95C8.9924 11.95 9.9498 10.9926 9.9498 9.75V4.75H8.5498V9.75C8.5498 10.1928 8.1926 10.55 7.7498 10.55C7.307 10.55 6.9498 10.1928 6.9498 9.75V4C6.9498 3.1716 7.6214 2.5 8.4498 2.5C9.2782 2.5 9.9498 3.1716 9.9498 4V9.75H11.3498V4C11.3498 1.9308 9.719 0.3 7.6498 0.3C5.5806 0.3 3.9498 1.9308 3.9498 4V9.75C3.9498 11.9867 5.7633 13.8002 8 13.8002C10.2367 13.8002 12.0498 11.9867 12.0498 9.75V4C12.0498 1.9308 10.419 0.3 8.3498 0.3C6.2806 0.3 4.6498 1.9308 4.6498 4V9.75C4.6498 10.9926 5.6072 11.95 6.8498 11.95C8.0924 11.95 9.0498 10.9926 9.0498 9.75V4.75H7.6498V9.75C7.6498 10.1928 7.2926 10.55 6.8498 10.55C6.407 10.55 6.0498 10.1928 6.0498 9.75V4C6.0498 3.1716 6.7214 2.5 7.5498 2.5C8.3782 2.5 9.0498 3.1716 9.0498 4V9.75H10.4498V4C10.4498 1.9308 8.819 0.3 6.7498 0.3C4.6806 0.3 3.0498 1.9308 3.0498 4V9.75C3.0498 11.9867 4.8633 13.8002 7.0998 13.8002C9.3363 13.8002 11.1498 11.9867 11.1498 9.75V4.5C11.1498 2.9536 9.8964 1.7002 8.3498 1.7002C6.8034 1.7002 5.5502 2.9536 5.5502 4.5V9.75Z";

const UPEM = 1024;
const SCALE = UPEM / 16;

/**
 * SVG（y-down）→ TTF（y-up）：放大 + 翻转 + 上移，原点落到字体底边。
 * svgpath 变换按调用顺序作用于路径点：先 scale(1,-1) 翻转到 [-16,0]，
 * 再 translate(0,16) 上移 —— 但这里直接用数学：y' = UPEM - y*SCALE。
 */
function toTtfPath(d, transform) {
  let p = svgpath(d);
  if (transform) p = p.translate(transform.tx, transform.ty);
  return p
    .scale(SCALE, -SCALE)
    .translate(0, UPEM)
    .round(1)
    .toString();
}

const folderUp = toTtfPath(FOLDER_PATH, FOLDER_TRANSFORM);
const clipUp = toTtfPath(CLIP_PATH);

// 快速自检：字形 y 范围应在 [0, UPEM]（y-up），x 在 [0, UPEM]
function bounds(p) {
  const nums = p.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const ys = nums.filter((_, i) => i % 2 === 1);
  const xs = nums.filter((_, i) => i % 2 === 0);
  return {
    x: [Math.min(...xs), Math.max(...xs)],
    y: [Math.min(...ys), Math.max(...ys)],
  };
}
for (const [name, p] of [["folder", folderUp], ["clip", clipUp]]) {
  const b = bounds(p);
  console.log(`${name}: x=[${b.x}] y=[${b.y}]`);
  if (b.y[0] < -1 || b.y[1] > UPEM + 1) throw new Error(`${name} y 越界，坐标转换错误`);
}

const svgFont = `<?xml version="1.0" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg">
  <defs>
    <font id="dshMentionIcons" horiz-adv-x="${UPEM}">
      <font-face font-family="DshMentionIcons" units-per-em="${UPEM}" ascent="${UPEM}" descent="0"/>
      <missing-glyph horiz-adv-x="${UPEM}"/>
      <glyph unicode="&#xE001;" d="${folderUp}"/>
      <glyph unicode="&#xE002;" d="${clipUp}"/>
    </font>
  </defs>
</svg>`;

const ttf = svg2ttf(svgFont, {
  description: "dsh-file-mention menu icons (kernel ic_ds_* copies)",
  version: "1.0",
});

const b64 = Buffer.from(ttf.buffer).toString("base64");
const out = `/**
 * 生成文件：scripts/make-iconfont.mjs（图标复制自内核 ic_ds_* 设计系统集）。
 * U+E001 文件夹（IconFolderClose16）、U+E002 回形针（IconPaperclipOutline16）。
 * 勿手改；重新生成见脚本头注释。
 */
export const MENTION_ICON_FONT_TTF_B64 =
  "${b64}";
`;
fs.writeFileSync(path.join(root, "src", "iconfont.ts"), out);
console.log(`src/iconfont.ts written (${b64.length} chars base64)`);
