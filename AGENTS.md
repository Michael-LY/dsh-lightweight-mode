# AGENTS.md — dsh-lightweight-mode

> 给在本仓库工作的 AI agent / 开发者的项目指南：架构、命令、约定、坑。
> 事实以 README.md 与实际代码为准；docs/design.md 是 v0.1 设计稿，其中「零改 DSH / 独立 Companion 进程」方案**已被取代**，仅作历史参考（见文末）。

## 1. 这是什么

DSH Desktop（Electron 桌面端）的「轻量模式」：窗口关闭到托盘后，等待可配置延迟（默认 30s），释放界面渲染内存——Windows 用 EmptyWorkingSet 回收 Tab / GPU / Utility 进程工作集；macOS/Linux 用 SIGSTOP 冻结——点托盘图标重开窗口时恢复。Host 进程与正在运行的 session 不中断。

由两部分组成：
1. **桌面内核补丁（路线 A）**：只改 app.asar 头部并注入 kernel 到 main.js，hook DSH 原生托盘菜单，加「轻量模式」项。可一键回滚，数据区不动。
2. **DSH 插件包**：在侧边栏「设置」加「轻量模式」面板，与托盘/内核共享同一份配置文件。

## 2. 架构 / 数据流

共享配置：~\.dsh\lightweight-mode.json（可用环境变量 DSH_HOME 覆盖目录）。字段：
- enabled: boolean（默认 true）
- delaySeconds: number（默认 30；写入时夹在 5–3600）
- mode: "auto" | "workingset" | "suspend"（默认 auto；auto = Windows 走 workingset，其余走 suspend）

三处都读写这同一个文件：
- 内核补丁（Electron **主进程**，注入进 main.js 的 kernel.js）
- Host 插件 lib/index.js（经 webServer 暴露 HTTP 路由）
- Client 插件 lib/client.js（设置面板 UI，通过上述 HTTP 路由读写）

流程：窗口 close → preventDefault + hide → kernel 计时 → 到点且仍隐藏则 release() 回收内存；窗口 show/focus → clearTimer + restore()。
托盘：kernel hook Tray.prototype.setContextMenu，向原生菜单 append：开关 / 延迟(15·30·60·300 秒) / 立即释放或恢复 / 状态。kernel 的 API 挂到 globalThis.__DSH_LIGHTWEIGHT_MODE__。

## 3. 目录结构

~~~
dsh-lightweight-mode/
├─ package.json            # type: module；exports "."→lib/index.js, "./client"→lib/client.js；dsh.bundle.patch / dsh.client
├─ cordis.patch.yml        # 插件 loader 行（id: lightweight-mode, 带默认 config）
├─ lib/
│  ├─ index.js             # Host 插件：写默认配置 + webServer 路由 /dsh-lightweight-mode/{config,state}
│  ├─ client.js            # Client 插件：注册 settings.section（id=lightweight-mode）
│  └─ patch/kernel.js      # 注入主进程的内核（自动注入；勿手改，改这里后必须重装）
├─ locale/{zh,en}.json     # 设置面板文案
├─ scripts/
│  ├─ install.ps1          # 装内核补丁（要求 DSH 已完全退出）
│  ├─ uninstall.ps1        # 回滚内核补丁
│  ├─ install-plugin.ps1   # 装设置面板插件到 profile（-DryRun 可先预览）
│  ├─ uninstall-plugin.ps1 # 移除插件
│  ├─ apply_patch.py       # 实际打补丁：改 asar header + 写 unpacked main.js
│  ├─ verify_patch.py      # 校验 unpacked main.js 的 size / sha256
│  ├─ rollback_patch.py    # 从备份恢复 header 并删除 unpacked main.js
│  ├─ measure.ps1          # 监控各 DSH 进程工作集内存（-Seconds N -Out file）
│  ├─ winstate.ps1         # 列出 DSH 可见窗口（pid|hwnd|title）
│  └─ fix_bom.py           # 去除配置 JSON 的 UTF-8 BOM
├─ state/patch-state.json  # 补丁状态：asar 路径、backupDir、mainSize、sha256
├─ backups/<stamp>/        # 每次安装的原 asar 头 header.bin + main.js.orig（回滚锚点）
├─ docs/design.md          # 早期设计稿（部分方案已过时）
└─ README.md
~~~

## 4. 常用命令

安装内核补丁（需先「完全退出」DSH Desktop —— 托盘图标 → Quit）：
~~~
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
~~~

安装设置面板插件（可选，同样需先退出 DSH；加 -DryRun 可先看 profile package.json 的变更）：
~~~
powershell -ExecutionPolicy Bypass -File .\scripts\install-plugin.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\install-plugin.ps1 -DryRun
~~~

校验补丁：
~~~
python scripts\verify_patch.py --asar "<app.asar 完整路径>"
~~~

回滚内核补丁 / 卸载插件：
~~~
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-plugin.ps1
~~~

观察内存与窗口（验证释放效果）：
~~~
powershell -ExecutionPolicy Bypass -File .\scripts\measure.ps1 -Seconds 60
powershell -ExecutionPolicy Bypass -File .\scripts\winstate.ps1
~~~

默认 asar 路径：C:\Users\<你>\AppData\Local\Programs\DeepSeek Harness\resources\app.asar（install.ps1 / uninstall.ps1 内置默认，可用 -Asar 覆盖）。

## 5. 补丁机制（重要，改代码前必读）

apply_patch.py 的步骤：
1. 读 app.asar：前 16 字节头 + header JSON（header 内含文件表与 offset/size）。
2. 定位 files.lib.files["main.js"]；若已 unpacked → 输出 ALREADY_PATCHED（幂等）。
3. 读取原 main.js 内容；把 import 锚点
   import { BrowserWindow, Menu, Notification, Tray,
   替换为加入 MenuItem 的版本。
4. 追加 lib/patch/kernel.js 全文到 main.js 末尾。
5. 把新 main.js 写入 app.asar.unpacked/lib/main.js；header 中该条目改为 {unpacked:true, size, integrity:{SHA256, blockSize, blocks}}。
6. 用新 header 重写 asar 头（padding 到原 header 长度；超长则 ERROR_HEADER_TOO_LONG）。
7. 备份到 backups/<stamp>/：header.bin（原 16+header）与 main.js.orig。

要点：只改「头部」与「unpacked 的 main.js」，asar 数据区其他文件一律不动；所以回滚是精确还原。rollback_patch.py 用 header.bin 还原头部 + 删除 unpacked main.js + 删 state 文件。

## 6. 编码约定

- 项目 type: module（ESM），lib 下用 import/export。
- 写文件一律 UTF-8 **无 BOM**；PowerShell 写 JSON 用 New-Object System.Text.UTF8Encoding($false)。
- kernel.js 是自动注入产物（文件头写明 do not edit）：不要改 app.asar.unpacked 里的副本；改逻辑请改 lib/patch/kernel.js 后重装。
- Python 脚本保持参数化（--asar / --kernel / --backup-dir / --state-file），不要硬编码路径。
- 配置字段范围：delaySeconds 5–3600（kernel 与 index.js 都会夹取）。

## 7. 坑 / 注意事项

- **必须先完全退出 DSH Desktop** 再安装/卸载/装插件，否则脚本以 exit 2 拒绝执行。
- DSH 升级会替换 app.asar → 补丁失效，需重跑 install.ps1（旧备份仍在 backups/ 与 state/patch-state.json；如状态不对可先 uninstall 再 install）。
- import 锚点依赖 DSH 版本的 import 结构；版本变化可能报 ERROR_IMPORT_ANCHOR_MISSING，需更新 apply_patch.py 里的 needle/repl。
- header 重写只能等长或更短，超长报 ERROR_HEADER_TOO_LONG（通常极小概率）。
- 平台效果差异：Windows EmptyWorkingSet 降幅明显；mac/Linux SIGSTOP 只止损、降幅有限。
- 配置 JSON 若带 BOM，kernel 读取时会兜底剥离，但其他读取方可能受影响 → 用 fix_bom.py 或让 install 写入无 BOM。
- 运行时日志：~\.dsh\lightweight-mode.log；内核状态可从 globalThis.__DSH_LIGHTWEIGHT_MODE__.state() 取。

## 8. 历史设计（已过时，勿照做）

docs/design.md（v0.1，2026-10-28）提出的是「**零改 DSH**」方案：
- 独立 Companion Electron 进程（自建一个 Tray 图标）+ 用 koffi / EnumWindows / osascript / wmctrl 轮询窗口可见性 + Host 插件 spawn 守护进程。

该方案**未被采用**，原因是 cordis 插件运行在 Host 子进程（ELECTRON_RUN_AS_NODE），拿不到 BrowserWindow / Tray，无法并入 DSH 原生托盘，只能另起一个托盘图标，体验割裂（见 design.md 2.4 / 第 3 节）。
实际实现改为「路线 A」：向 app.asar 注入主进程内核，直接 hook 原生 Tray.prototype.setContextMenu。

阅读时若 docs/design.md 与 README.md / 代码冲突，**以 README.md 与代码为准**，design.md 仅作历史参考。

## 9. 改动后自检

- 改了 lib/patch/kernel.js：先 uninstall 再 install，然后 verify_patch.py 应输出 VERIFY_OK。
- 改了插件：重跑 install-plugin.ps1（可先 -DryRun 预览 profile package.json 变更）。
- 验证压缩效果：measure.ps1 -Seconds 60 → 关窗等待 delay → 看 total_mb 是否下降；winstate.ps1 确认窗口已隐藏。
