#!/usr/bin/env python3
"""
make-icons.py — 生成 @文件 候选菜单的文件类型图标 SVG。

输出 src/file-icons.ts（内联 SVG 字符串 + 扩展名→图标映射），
client 半以 data URL 注入 <img> 渲染。

图标风格：16×16，每种类型有独特的形状/线条组合 + 独立颜色，
确保 16px 小尺寸下也能区分。

重新生成：python3 scripts/make-icons.py
"""
import os

# ── 文件类型定义 ──────────────────────────────────────────────────────
# (key, label, color, extensions, svg_body)
# svg_body 是 <path>/<line> 等内部元素，不含外层 <svg>

def _file_frame(color, opacity=0.18):
    """通用文件外框（圆角矩形 + 折角）。"""
    return (
        f'<path d="M3 1.5C3 1.22386 3.22386 1 3.5 1H9.5L13.5 5V14.5C13.5 14.7761 13.2761 15 13 15H3.5C3.22386 15 3 14.7761 3 14.5V1.5Z" '
        f'fill="{color}" fill-opacity="{opacity}" stroke="{color}" stroke-width="1.2"/>'
        f'<path d="M9.5 1V5H13" stroke="{color}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>'
    )

def _ts_body(c):
    """TypeScript: 文件框 + 对角 T+S 线条"""
    return _file_frame(c) + f'<path d="M5.5 9H9.5V12.5" stroke="{c}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>'

def _js_body(c):
    """JavaScript: 文件框 + 花括号"""
    return _file_frame(c) + f'<path d="M6.5 8C5.5 8 5.5 8.5 5.5 9.5C5.5 10.5 5.5 11 4.5 11M9.5 8C10.5 8 10.5 8.5 10.5 9.5C10.5 10.5 10.5 11 11.5 11" stroke="{c}" stroke-width="1.2" stroke-linecap="round" fill="none"/>'

def _json_body(c):
    """JSON: 文件框 + 花括号 + 点"""
    return _file_frame(c) + f'<path d="M6 8.5C5.5 8.5 5 9 5 9.5C5 10 5 10.5 4.5 10.5M10 8.5C10.5 8.5 11 9 11 9.5C11 10 11 10.5 11.5 10.5" stroke="{c}" stroke-width="1.1" stroke-linecap="round" fill="none"/>' + f'<circle cx="8" cy="9.5" r="0.6" fill="{c}"/>'

def _md_body(c):
    """Markdown: 文件框 + M 形折线"""
    return _file_frame(c) + f'<path d="M5 12V8.5L6.5 10.5L8 8.5L9.5 10.5V12" stroke="{c}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'

def _css_body(c):
    """CSS: 文件框 + 井号"""
    return _file_frame(c) + f'<path d="M6.5 8.5L5.5 11.5M9 8.5L8 11.5M5.8 9.5H9.3M5.5 10.5H9" stroke="{c}" stroke-width="1" stroke-linecap="round"/>'

def _html_body(c):
    """HTML: 文件框 + 尖括号"""
    return _file_frame(c) + f'<path d="M5.5 8.5L4.5 10L5.5 11.5M10.5 8.5L11.5 10L10.5 11.5" stroke="{c}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'

def _py_body(c):
    """Python: 文件框 + 双蛇 S 曲线"""
    return _file_frame(c) + f'<path d="M7 8.5C5.5 8.5 5.5 9.5 7 9.5C8.5 9.5 8.5 10.5 7 10.5C5.5 10.5 5.5 11.5 7 11.5" stroke="{c}" stroke-width="1.1" stroke-linecap="round" fill="none"/>'

def _go_body(c):
    """Go: 文件框 + 圆点（gopher 简化）"""
    return _file_frame(c) + f'<circle cx="8" cy="9.5" r="1.5" stroke="{c}" stroke-width="1.1" fill="none"/>' + f'<path d="M8 8V7.5" stroke="{c}" stroke-width="1" stroke-linecap="round"/>'

def _rs_body(c):
    """Rust: 文件框 + 齿轮简化（八角星）"""
    return _file_frame(c) + f'<path d="M8 8L8.3 9L9 9.3L8.3 9.6L8 10.3L7.7 9.6L7 9.3L7.7 9Z" stroke="{c}" stroke-width="0.9" fill="{c}" fill-opacity="0.3" stroke-linejoin="round"/>'

def _sh_body(c):
    """Shell: 文件框 + 提示符 >_"""
    return _file_frame(c) + f'<path d="M5.5 9L7 10L5.5 11" stroke="{c}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' + f'<path d="M8 11H10" stroke="{c}" stroke-width="1.2" stroke-linecap="round"/>'

def _yml_body(c):
    """YAML: 文件框 + 列表点 + 线"""
    return _file_frame(c) + f'<circle cx="5.5" cy="9" r="0.5" fill="{c}"/>' + f'<circle cx="5.5" cy="11" r="0.5" fill="{c}"/>' + f'<path d="M7 9H10M7 11H10" stroke="{c}" stroke-width="1" stroke-linecap="round"/>'

def _txt_body(c):
    """文本: 文件框 + 三条横线"""
    return _file_frame(c) + f'<path d="M5.5 9H10.5M5.5 10.5H10.5M5.5 12H9" stroke="{c}" stroke-width="1" stroke-linecap="round"/>'

def _bin_body(c):
    """二进制: 文件框 + 01 数字"""
    return _file_frame(c) + f'<circle cx="6.5" cy="10" r="1" stroke="{c}" stroke-width="0.9" fill="none"/>' + f'<path d="M9.5 9V11" stroke="{c}" stroke-width="1.1" stroke-linecap="round"/>'

def _db_body(c):
    """数据库: 文件框 + 圆柱"""
    return _file_frame(c) + f'<ellipse cx="8" cy="9" rx="2" ry="0.8" stroke="{c}" stroke-width="0.9" fill="none"/>' + f'<path d="M6 9V11C6 11.44 6.89 11.8 8 11.8C9.11 11.8 10 11.44 10 11V9" stroke="{c}" stroke-width="0.9" fill="none"/>'

def _img_body(c):
    """图片: 文件框 + 山形 + 太阳"""
    return _file_frame(c) + f'<path d="M5.5 12L7 10L8.5 11.5L10 9.5V12H5.5Z" stroke="{c}" stroke-width="0.9" fill="{c}" fill-opacity="0.3" stroke-linejoin="round"/>' + f'<circle cx="6" cy="8.5" r="0.7" fill="{c}"/>'

def _folder_body(c):
    """文件夹"""
    return f'<path d="M2 4.5C2 3.67157 2.67157 3 3.5 3H6.17157C6.50498 3 6.8208 3.13261 7.05025 3.36207L7.63793 3.94975C7.86739 4.1792 8.18321 4.31182 8.51662 4.31182H12.5C13.3284 4.31182 14 4.98339 14 5.81182V11.5C14 12.3284 13.3284 13 12.5 13H3.5C2.67157 13 2 12.3284 2 11.5V4.5Z" fill="{c}" fill-opacity="0.18" stroke="{c}" stroke-width="1.2" stroke-linejoin="round"/>'

FILE_TYPES = [
    ("ts",   "TypeScript", "#3178C6", ["ts", "tsx"],               _ts_body),
    ("js",   "JavaScript", "#F1E05A", ["js", "jsx", "mjs", "cjs"], _js_body),
    ("json", "JSON",       "#F9A825", ["json", "jsonc", "json5"],  _json_body),
    ("md",   "Markdown",   "#6E7B8B", ["md", "mdx", "markdown"],   _md_body),
    ("css",  "CSS",        "#42A5F5", ["css", "scss", "sass", "less"], _css_body),
    ("html", "HTML",       "#E44D26", ["html", "htm", "xml", "svg"],   _html_body),
    ("py",   "Python",     "#3776AB", ["py", "pyi"],               _py_body),
    ("go",   "Go",         "#00ADD8", ["go"],                      _go_body),
    ("rs",   "Rust",       "#DEA584", ["rs"],                      _rs_body),
    ("sh",   "Shell",      "#8BC34A", ["sh", "bash", "zsh", "fish", "ps1", "bat", "cmd"], _sh_body),
    ("yml",  "YAML",       "#CB4B16", ["yml", "yaml", "toml", "ini", "conf", "cfg"], _yml_body),
    ("txt",  "Text",       "#9E9E9E", ["txt", "log", "csv", "tsv", "env", "lock"], _txt_body),
    ("bin",  "Binary",     "#78909C", ["png", "jpg", "jpeg", "gif", "webp", "ico", "pdf", "woff", "woff2", "ttf", "otf", "mp3", "mp4", "zip", "tar", "gz", "7z", "exe", "dll", "so", "dylib"], _bin_body),
    ("db",   "Database",   "#0F9D58", ["sql", "db", "sqlite", "sqlite3"], _db_body),
    ("img",  "Image",      "#EC407A", ["svg", "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "tiff", "avif"], _img_body),
]

# 扩展名 → 图标 key 映射
EXT_MAP = {}
for key, label, color, exts, _body in FILE_TYPES:
    for e in exts:
        if e not in EXT_MAP:
            EXT_MAP[e] = key

def _wrap_svg(body):
    """把 body 包进 16×16 SVG 外层。"""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">'
        + body.replace("\n", "")
        + '</svg>'
    )

# ── 生成 TS 输出 ──────────────────────────────────────────────────────
def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(root, "src")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "file-icons.ts")

    lines = [
        "/**",
        " * 生成文件：scripts/make-icons.py",
        " * 文件类型候选菜单图标（16×16 内联 SVG，data URL 渲染）。",
        " * 勿手改；重新生成：python3 scripts/make-icons.py",
        " */",
        "",
        "type FileIcon = { key: string; svg: string };",
        "",
        "export const FILE_ICONS: Record<string, FileIcon> = {",
    ]

    for key, label, color, exts, body_fn in FILE_TYPES:
        svg = _wrap_svg(body_fn(color))
        lines.append(f'  "{key}": {{ key: "{key}", svg: {repr(svg)} }},')

    # 文件夹图标
    folder = _wrap_svg(_folder_body("#FFB74D"))
    lines.append(f'  "dir": {{ key: "dir", svg: {repr(folder)} }},')

    # 纯文本图标（无扩展名或未知扩展名）
    text = _wrap_svg(_txt_body("#9E9E9E"))
    lines.append(f'  "text": {{ key: "text", svg: {repr(text)} }},')

    lines.append("};")
    lines.append("")

    # 扩展名映射
    lines.append("export const EXT_TO_ICON: Record<string, string> = {")
    for ext, key in sorted(EXT_MAP.items()):
        lines.append(f'  "{ext}": "{key}",')
    lines.append("};")
    lines.append("")

    content = "\n".join(lines)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"wrote {out_path} ({len(content)} bytes)")

if __name__ == "__main__":
    main()
