"use strict";
/**
 * dsh-desktop preload —— 以最小表面暴露桌面环境信息，
 * 不向页面开放任何 Node 能力（contextIsolation + sandbox）。
 */
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("dshDesktop", {
  appName: "DeepSeek Harness 桌面版",
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
