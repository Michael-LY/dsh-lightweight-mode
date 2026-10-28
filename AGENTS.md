# AGENTS.md — dsh-lightweight-mode

> 给在本仓库工作的 AI agent / 开发者的项目指南：架构、命令、约定、坑。
> 事实以 README.md 与实际代码为准；docs/design.md 是 v0.1 设计稿，其中「零改 DSH / 独立 Companion 进程」方案**已被取代**，仅作历史参考（见文末）。

## 1. 这是什么

DSH Desktop（Electron 桌面端）的「轻量模式」：窗口关闭到托盘后，等待可配置延迟（默认 30s），释放界面渲染内存——Windows 用 EmptyWorkingSet 回收 Tab / GPU / Utility 进程工作集；macOS/Linux 用 SIGSTOP 冻结——点托盘图标重开窗口时瞬间恢复。Host 进程与正在运行的 session 不中断。

由两部分组成：
1. **桌面内核补丁（路线 A）**：只改 app.asar 头部并注入 kernel 到 main.js，hook DSH 原生托盘，追加「轻量模式」控制项与状态行。**Windows 下接管托盘右键、每次弹出前重建菜单以实时反映释放状态**（`popUpContextMenu`，`menu.popup()` 兜底）；mac/Linux 仍沿用原生静态菜单。可一键回滚，数据区不动。
2. **DSH 插件包**：在侧边栏「设置」加「轻量模式」面板（原生 Design Token 风格），与托盘/内核共享同一份配置文件。

## 2. 架构 / 数据流

共享配置：`~/.dsh/lightweight-mode.json`（可用环境变量 DSH_HOME 覆盖目录）。字段：
- `enabled`: boolean（默认 `true`）
- `delaySeconds`: number（默认 `30`；写入时夹在 5–3600）
- `mode`: `"auto"` | `"workingset"` | `"suspend"`（默认 `auto`；auto = Windows 走 workingset，其余走 suspend）

三处都读写这同一个文件：
- 内核补丁（Electron **主进程**，注入进 main.js 的 kernel.js）
- Host 插件 `lib/index.js`（经 webServer 暴露 HTTP 路由 `/dsh-lightweight-mode/{config,state}`）
- Client 插件 `lib/client.js`（设置面板 UI，通过上述 HTTP 路由读写）

流程：窗口 close → preventDefault + hide → kernel 计时 → 到点且仍隐藏则 `release()` 回收内存；窗口 show/focus → `clearTimer()` + `restore()`。
托盘：kernel hook `Tray.prototype.setContextMenu`，向菜单追加：开关 / 延迟(15·30·60·300 秒) / 立即释放或恢复 / 状态行，并在 `globalThis.__DSH_LIGHTWEIGHT_MODE__` 暴露 API（`release/restore/schedule/state`）。

托盘菜单按平台分两种实现：
- **Windows**：hook 时**不调用**原生 `setContextMenu`（避免静态菜单 label 冻结），而是保存菜单对象并监听 `right-click`；每次右键先用 `syncLabels()` 依据当前 `released`/`lastMode` 刷新「立即释放/恢复」与「状态」两项文案，再 `tray.popUpContextMenu(menu)` 弹出，不可用时回退 `menu.popup()`。左键点击仍走 DSH 原生 `tray.on('click')`（打开窗口）。这就是「点了立即释放、状态仍显示未释放」问题的根因修复点。
- **macOS/Linux**：沿用原生静态 `setContextMenu`（`syncLabels()` 会改 label，是否即时重绘取决于平台）。

状态同步：`release()` / `restore()` 末尾都会调用 `syncLabels()`，保证内存状态变化后文案一致；`state()` 返回 `{released,lastReleaseAt,lastMode,config}`。

## 3. 设置面板与前端规范

- **槽位注册**：通过 `ctx.slots.inject('settings.section', ...)` 注入，id 为 `lightweight-mode`。
- **导航名称（i18n）**：侧边栏按钮名称严格为 **「轻量模式」**（英文环境显示 **「Lightweight Mode」**），严禁回退或裸露显示内部 key（如 `nav` 或 `title`）。`client.js` 中通过 `ctx.locale.register` 注册 `dsh-lightweight-mode` 命名空间，并内置稳健的兜底检测（`isZh()`）。
- **UI 设计规范**：
  - 容器与卡片严格对齐 DSH 原生 Design Token（`--dsw-alias-border-l2`、`--dsw-alias-bg-layer-*`、`--dsw-alias-label-*`、`--dsw-alias-button-primary-fill` 等），无缝支持暗色与明亮模式。
  - 顶部带有动态状态徽标（绿色呼吸点与「已启用」/「已停用」）。
  - 开关采用自定义无障碍 Switch（`role="switch"`，38×22px 平滑过渡）。
  - 延迟提供分段快选（15s / 30s / 1m / 5m）与带单位数字输入框联动。
  - 底部提供「保存设置」（带保存反馈）与「恢复默认」快捷按钮。

## 4. 目录结构

~~~
dsh-lightweight-mode/
├─ package.json            # type: module；exports "."→lib/index.js, "./client"→lib/client.js；dsh.client 声明依赖
├─ cordis.patch.yml        # 插件 loader 行（id: lightweight-mode, 带默认 config）
├─ lib/
│  ├─ index.js             # Host 插件：写默认配置 + webServer 路由 /dsh-lightweight-mode/{config,state}
│  ├─ client.js            # Client 插件：注册 settings.section（原生规范 UI + 完善 i18n）
│  └─ patch/kernel.js      # 注入主进程的内核（自动注入；勿手改，改这里后必须重装）
├─ locale/{zh,en}.json     # 设置面板文案（中英文对照）
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

## 5. 常用命令

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

## 6. 补丁机制（重要，改代码前必读）

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

## 7. 编码约定

- 项目 type: module（ESM），lib 下用 import/export。
- 写文件一律 UTF-8 **无 BOM**；PowerShell 写 JSON 用 New-Object System.Text.UTF8Encoding($false)。
- kernel.js 是自动注入产物（文件头写明 do not edit）：不要把 app.asar.unpacked 里的副本当作"源"手改；改逻辑请改 lib/patch/kernel.js，再重装（或按第 10 节应急流程重注入），随后**必须完全退出并重开 DSH** 才生效（主进程代码不热重载）。
- 托盘菜单实现：Windows 走 `right-click` + `popUpContextMenu`（`menu.popup()` 兜底），不设静态菜单；mac/Linux 走原生 `setContextMenu`。修改此处务必保留平台分支，否则 Windows 会退回"状态冻结"问题。
- Python 脚本保持参数化（--asar / --kernel / --backup-dir / --state-file），不要硬编码路径。
- 配置字段范围：delaySeconds 5–3600（kernel 与 index.js 都会夹取）。

## 8. 坑 / 注意事项

- **必须先完全退出 DSH Desktop** 再安装/卸载/装插件，否则脚本以 exit 2 拒绝执行。
- DSH 升级会替换 app.asar → 补丁失效，需重跑 install.ps1（旧备份仍在 backups/ 与 state/patch-state.json；如状态不对可先 uninstall 再 install）。
- import 锚点依赖 DSH 版本的 import 结构；版本变化可能报 ERROR_IMPORT_ANCHOR_MISSING，需更新 apply_patch.py 里的 needle/repl。
- header 重写只能等长或更短，超长报 ERROR_HEADER_TOO_LONG（通常极小概率）。
- 平台效果差异：Windows EmptyWorkingSet 降幅明显；mac/Linux SIGSTOP 只止损、降幅有限。
- 配置 JSON 若带 BOM，kernel 读取时会兜底剥离，但其他读取方可能受影响 → 用 fix_bom.py 或让 install 写入无 BOM。
- 运行时日志：`~/.dsh/lightweight-mode.log`；内核状态可从 `globalThis.__DSH_LIGHTWEIGHT_MODE__.state()` 取。
- **主进程 kernel 改动不热重载**：改 `lib/patch/kernel.js` 并重装/重注入后，必须「完全退出 DSH 再打开」才生效；运行中的 DSH 仍执行旧逻辑。
- **Windows 托盘右键无菜单 / 状态不刷新**：该问题已由"右键动态菜单 + `syncLabels()`"修复；若仍旧出现，查日志是否有 `tray patch failed` / `tray popup error` / `menu popup fallback error`，并确认已重启加载新 kernel。

## 9. 历史设计（已过时，勿照做）

docs/design.md（v0.1，2026-10-28）提出的是「**零改 DSH**」方案：
- 独立 Companion Electron 进程（自建一个 Tray 图标）+ 用 koffi / EnumWindows / osascript / wmctrl 轮询窗口可见性 + Host 插件 spawn 守护进程。

该方案**未被采用**，原因是 cordis 插件运行在 Host 子进程（ELECTRON_RUN_AS_NODE），拿不到 BrowserWindow / Tray，无法并入 DSH 原生托盘，只能另起一个托盘图标，体验割裂（见 design.md 2.4 / 第 3 节）。
实际实现改为「路线 A」：向 app.asar 注入主进程内核，直接 hook 原生 Tray.prototype.setContextMenu。

阅读时若 docs/design.md 与 README.md / 代码冲突，**以 README.md 与代码为准**，design.md 仅作历史参考。

## 10. 改动后自检

- 改了 lib/patch/kernel.js：先 uninstall 再 install，然后 verify_patch.py 应输出 VERIFY_OK；**之后完全退出并重开 DSH** 加载新内核。
- **应急在线更新内核（DSH 运行中、无法走 uninstall→install）**：取现行 `app.asar.unpacked/lib/main.js`，把其中 `/* ===== dsh-lightweight-mode kernel` 至 `/* ===== end dsh-lightweight-mode kernel ===== */` 段替换为新的 `lib/patch/kernel.js` 内容；重算 `sha256`/`size` 写回 asar header 的 `main.js` 条目，并同步 `state/patch-state.json`（**`backupDir` 必须仍指向未打补丁的原始备份**，作为回滚锚点）；`verify_patch.py` 应 `VERIFY_OK`，再重启 DSH。此为等价替换、不改 asar 数据区，但标准流程仍以 uninstall→install 为准。
- 改了插件（client/index）：重跑 install-plugin.ps1（可先 -DryRun 预览 profile package.json 变更）；已存在 junction 时客户端按 Ctrl+R 即可热加载生效。
- 验证压缩效果：measure.ps1 -Seconds 60 → 关窗等待 delay → 看 total_mb 是否下降；winstate.ps1 确认窗口已隐藏。
