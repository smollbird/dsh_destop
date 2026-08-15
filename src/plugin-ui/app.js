/**
 * app.js —— 插件管理 UI 逻辑（无框架，直接调用 window.dshPlugin 桥）
 */
"use strict";

/* eslint-env browser */
const api = window.dshPlugin;

const $ = (id) => document.getElementById(id);

const els = {
  profileSelect: $("profileSelect"),
  refreshBtn: $("refreshBtn"),
  pkgInput: $("pkgInput"),
  installBtn: $("installBtn"),
  searchInput: $("searchInput"),
  searchBtn: $("searchBtn"),
  searchResults: $("searchResults"),
  listStatus: $("listStatus"),
  pluginBody: $("pluginBody"),
  logBox: $("logBox"),
  restartBtn: $("restartBtn"),
  restartHint: $("restartHint"),
};

let busy = false;

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function setBusy(flag) {
  busy = flag;
  [els.installBtn, els.refreshBtn, els.searchBtn, els.restartBtn].forEach(
    (btn) => (btn.disabled = flag)
  );
}

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("zh-CN", { hour12: false });
}

/* ------------------------------------------------------------------ */
/* 日志                                                                */
/* ------------------------------------------------------------------ */

function appendLog(entry) {
  const line = document.createElement("div");
  line.className = `log-line ${entry.level}`;
  const ts = document.createElement("span");
  ts.className = "ts";
  ts.textContent = fmtTime(entry.ts);
  const msg = document.createElement("span");
  msg.className = "msg";
  msg.textContent = entry.text;
  line.append(ts, msg);
  els.logBox.appendChild(line);
  els.logBox.scrollTop = els.logBox.scrollHeight;
}

/* ------------------------------------------------------------------ */
/* 列表                                                                */
/* ------------------------------------------------------------------ */

function badgeFor(plugin) {
  const map = {
    bundle: ["bundle", "内置"],
    patch: ["patch", "已启用"],
    dependency: ["dependency", "未启用"],
  };
  const [cls, label] = map[plugin.source] || ["dependency", plugin.source];
  return `<span class="badge ${cls}">${label}</span>`;
}

function statusFor(plugin) {
  if (plugin.source === "bundle") return '<span class="badge on">启用</span>';
  return plugin.enabled
    ? '<span class="badge on">启用</span>'
    : '<span class="badge off">停用</span>';
}

function actionsFor(plugin) {
  if (plugin.source === "bundle") {
    return '<span class="status-hint">内置 bundle</span>';
  }
  const toggle = plugin.enabled
    ? `<button class="btn small" data-act="disable" data-pkg="${esc(plugin.id)}">停用</button>`
    : `<button class="btn small" data-act="enable" data-pkg="${esc(plugin.id)}">启用</button>`;
  const remove = `<button class="btn small danger" data-act="remove" data-pkg="${esc(plugin.id)}">卸载</button>`;
  return `<div class="cell-actions">${toggle}${remove}</div>`;
}

function renderList(payload) {
  const { plugins, profiles, activeProfile } = payload;
  // profile 下拉
  els.profileSelect.innerHTML = profiles
    .map((p) => `<option value="${esc(p)}" ${p === activeProfile ? "selected" : ""}>${esc(p)}</option>`)
    .join("");
  els.profileSelect.disabled = profiles.length === 0;

  if (!plugins.length) {
    els.pluginBody.innerHTML = `<tr><td colspan="5" class="empty">暂无插件。输入包名安装第一个插件吧。</td></tr>`;
    els.listStatus.textContent = `（${activeProfile} · 0 个）`;
    return;
  }
  els.pluginBody.innerHTML = plugins
    .map(
      (p) => `<tr>
        <td class="name-cell">
          <div class="pkg">${esc(p.name)}</div>
          ${p.id !== p.name ? `<div class="id">${esc(p.id)}</div>` : ""}
        </td>
        <td>${esc(p.version)}</td>
        <td>${badgeFor(p)}</td>
        <td>${statusFor(p)}</td>
        <td>${actionsFor(p)}</td>
      </tr>`
    )
    .join("");
  els.listStatus.textContent = `（${activeProfile} · ${plugins.length} 个）`;
}

async function refresh() {
  try {
    setBusy(true);
    els.listStatus.textContent = "读取中…";
    const payload = await api.list();
    renderList(payload);
    els.listStatus.textContent = `（${payload.activeProfile} · ${payload.plugins.length} 个）`;
  } catch (err) {
    els.listStatus.textContent = `读取失败：${err.message}`;
    appendLog({ ts: new Date().toISOString(), level: "error", text: `读取列表失败：${err.message}` });
  } finally {
    setBusy(false);
  }
}

/* ------------------------------------------------------------------ */
/* 安装 / 卸载 / 启停                                                  */
/* ------------------------------------------------------------------ */

async function install(pkg) {
  if (!pkg) return;
  setBusy(true);
  try {
    const res = await api.add(pkg);
    if (!res.ok && res.error) {
      appendLog({ ts: new Date().toISOString(), level: "error", text: res.error });
    }
    els.pkgInput.value = "";
    await refresh();
    if (res.ok) hintRestart();
  } finally {
    setBusy(false);
  }
}

async function remove(pkg) {
  if (!window.confirm(`确定卸载插件「${pkg}」吗？`)) return;
  setBusy(true);
  try {
    await api.remove(pkg);
    await refresh();
    hintRestart();
  } finally {
    setBusy(false);
  }
}

async function setEnabled(pkg, enabled) {
  setBusy(true);
  try {
    await api.setEnabled(pkg, enabled);
    await refresh();
    hintRestart();
  } finally {
    setBusy(false);
  }
}

function hintRestart() {
  els.restartHint.textContent = "插件变更已保存，点击「重启服务」生效";
  els.restartBtn.classList.add("pulse");
  setTimeout(() => els.restartBtn.classList.remove("pulse"), 2000);
}

async function restart() {
  setBusy(true);
  els.restartHint.textContent = "重启中…（主窗口会刷新）";
  try {
    const res = await api.restart();
    els.restartHint.textContent = res.ok ? "服务已重启" : `重启失败：${res.error || "未知错误"}`;
  } finally {
    setBusy(false);
  }
}

/* ------------------------------------------------------------------ */
/* 社区搜索                                                            */
/* ------------------------------------------------------------------ */

async function search() {
  const q = els.searchInput.value.trim();
  if (!q) return;
  setBusy(true);
  try {
    const items = await api.search(q);
    els.searchResults.classList.remove("hidden");
    els.searchResults.innerHTML = items.length
      ? items
          .map(
            (it) => `<div class="search-item">
              <div class="meta">
                <div class="name">${esc(it.fullName)} <span class="stars">★ ${it.stars}</span></div>
                <div class="desc">${esc(it.description)}</div>
              </div>
              <button class="btn small primary" data-act="install-search" data-pkg="${esc(it.fullName)}">安装</button>
            </div>`
          )
          .join("")
      : '<div class="status-hint" style="padding:6px 8px">没有找到相关插件（可尝试在 GitHub 搜索 topic:dsh-plugin）</div>';
  } catch (err) {
    appendLog({ ts: new Date().toISOString(), level: "error", text: `搜索失败：${err.message}` });
  } finally {
    setBusy(false);
  }
}

/* ------------------------------------------------------------------ */
/* 事件绑定                                                            */
/* ------------------------------------------------------------------ */

els.installBtn.addEventListener("click", () => install(els.pkgInput.value.trim()));
els.pkgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") install(els.pkgInput.value.trim());
});
els.searchBtn.addEventListener("click", search);
els.searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") search();
});
els.refreshBtn.addEventListener("click", refresh);
els.restartBtn.addEventListener("click", restart);
els.profileSelect.addEventListener("change", async () => {
  await api.setProfile(els.profileSelect.value);
  els.searchResults.classList.add("hidden");
  await refresh();
});

els.pluginBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn || busy) return;
  const { act, pkg } = btn.dataset;
  if (act === "enable") setEnabled(pkg, true);
  else if (act === "disable") setEnabled(pkg, false);
  else if (act === "remove") remove(pkg);
});

els.searchResults.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act='install-search']");
  if (!btn || busy) return;
  install(btn.dataset.pkg);
});

/* ------------------------------------------------------------------ */
/* 启动                                                                */
/* ------------------------------------------------------------------ */

if (!api) {
  els.pluginBody.innerHTML =
    '<tr><td colspan="5" class="empty">插件 API 不可用（preload 未加载）</td></tr>';
} else {
  api.onLog(appendLog);
  refresh();
}
