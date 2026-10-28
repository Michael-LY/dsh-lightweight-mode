# DSH Lightweight Mode 设计文档

> 版本：v0.1（设计稿，待确认）
> 日期：2026-10-28
> 目标产品：DeepSeek Harness Desktop（官方 Electron 桌面端 0.2.1-rc.3）
> 项目目录：`dsh-lightweight-mode/`

## 1. 目标与非目标

### 目标
- 关闭 DSH Desktop 主窗口（缩到托盘）后，在可配置延迟（默认 **30 秒**）后释放界面绘制占用的内存，只保留 dsh 核心运行时（Host 进程、session、正在跑的 agent 任务）。
- 点击托盘图标重新打开窗口时，界面正常恢复（必要时重新绘制）。
- 作为 **DSH 插件** 安装与分发；**不修改 DSH 本体**；不受 DSH 桌面端版本升级影响。
- 托盘菜单提供「轻量模式」子菜单（开关 / 延迟 / 立即释放）。
- 侧边栏设置里提供「轻量模式」配置面板。
- 多平台：Windows（主力，效果最好）、macOS、Linux（best-effort）。

### 非目标
- 不终止、不重启、不迁移任何 dsh 进程或会话。
- 不修改 `app.asar` 内任何文件。
- 不改动用户已有配置与数据。
- 不做跨会话的持久化状态迁移。

## 2. 现状调研结论（本机代码实测）

### 2.1 目标应用架构
- **Electron 主进程**：`resources/app.asar/lib/main.js`（约 1.3 万行）。负责窗口、托盘（`DesktopTray`，第 11696 行）、更新、退出。
- **dsh Host 子进程**：主进程 spawn `@deepseek-ai/dsh-desktop-host/lib/index.js`，以 `ELECTRON_RUN_AS_NODE=1` 运行，参数指向 `.dsh/profiles/desktop`。**所有 cordis 插件都运行在这个子进程里**。
- **渲染层**：`loadURL('dsh-app://app/')` 转发到本机 `127.0.0.1:<port>` 的标准 dsh Web UI。
- 主进程与 Host 之间只有 Node IPC，现有控制消息仅：`update-tasks`、`quit-inspection`、`shutdown`（`isDesktopHostEvent`，main.js 第 3665-3702 行），**无窗口控制通道**。

### 2.2 关窗现状
- `window.on('close')` → `preventDefault()` → `hideMainWindow()` → `window.hide()`（第 12895-12907 行）。
- 托盘常驻，点击 → `focusPrimaryWindow()` → `show()`（第 13032 行）。
- 结果：窗口只是隐藏，**主进程 / GPU / renderer / Host 子进程全部存活，渲染内存不释放**。这就是 600–900MB 不下降的原因。
- 已有 `DesktopBackgroundNotice`：首次关窗提示「后台运行」，说明「关窗=托盘」已是产品既定行为。

### 2.3 插件体系
- 插件 = npm 包，装进 `.dsh/profiles/desktop`，在 profile 的 `cordis.patch.yml` 里 `insert` 一个 loader 条目。
- 插件可同时具备两半：
  - **Host 半**：`lib/index.js`，cordis 插件（`export const Config / apply`），运行在 Host 子进程。
  - **Client 半**：`lib/client.js`，`window.__ModuleLoader__.load({ id, factory })` 浏览器 bundle；`package.json` 声明 `dsh.client: { platform:'web', inject:[...] }`，由 `@deepseek-ai/dsh-client-modules` 扫描并下发到 `/plugins`。
- **设置扩展**：Client 半用 `ctx.slots.register({ name:'settings.section', id, order, label, locale }, Component)` 注册设置页分区（参考 `dsh-client-ui-settings-general` 的 `GeneralSection`）。
- **设置读写**：Host 半用 schemastery `Config` + `ctx.inject(['settings'], c => c.settings.configure({auto:false}, ctx.fiber))` 声明命名空间；Client 半用 `ctx.remote.settings.describe()` / `ctx.remote.settings.mutate(ns, ops, revision)` 读写。

### 2.4 硬约束（决定方案形态）
- **Cordis 插件拿不到 Electron 的 `BrowserWindow` / `Tray` / `app`**：它在 Host 子进程（Node 模式）里。
- 因此「**向 DSH 原生托盘菜单插入子菜单**」在「不修改 DSH」前提下**做不到**——托盘菜单是主进程私有的 Electron `Menu`。
- 「销毁/重建窗口」同样只能由主进程做，插件做不到。

## 3. 关键取舍（需你确认）

| 需求 | 零改 DSH 下能否实现 | 本设计的处理 |
|---|---|---|
| 释放界面渲染内存 | 能（从外部对 renderer/GPU 进程做工作集回收 / 挂起） | 见第 4 节平台策略 |
| 托盘里加「轻量模式」子菜单 | **不能并入 DSH 托盘** | 插件**自建一个独立托盘图标**（跨平台，由伴随进程提供），菜单项与 DSH 托盘并列 |
| 侧边栏设置加「轻量模式」面板 | 能（Client 插件 slot） | 按官方 settings.section 规范实现 |
| 不受升级影响 | 能（file: 装进 profile，不动 asar） | 只依赖稳定插件 API + 版本核对脚本 |
| 多平台 | 能，但效果因平台而异 | 见平台能力矩阵 |

> ⚠️ 唯一需要你拍板的冲突：**「托盘子菜单」只能以「新增一个独立托盘图标」的形式存在**，无法合并进 DSH 自己那个托盘图标。若你坚持并入 DSH 托盘，就必须修改 `app.asar/lib/main.js`，与「不修改 DSH」冲突。

## 4. 总体架构

```
┌────────────────────────── DSH Desktop ──────────────────────────┐
│ Electron 主进程 (lib/main.js)   ← 完全不改                        │
│   └─ spawn → dsh-desktop-host (Host 子进程, ELECTRON_RUN_AS_NODE) │
│        └─ cordis 插件: dsh-lightweight-mode (Host 半)             │
│             ├─ 声明 Config (enabled / delaySeconds / mode)        │
│             ├─ 读写 ~/.dsh/lightweight-mode.json                  │
│             └─ 启动/守护 → Companion 进程（下方）                 │
│   └─ 渲染进程: 标准 dsh Web UI                                    │
│        └─ Client 插件: 设置页「轻量模式」分区                      │
└──────────────────────────────────────────────────────────────────┘
          ▲ 文件/参数/IPC                        │ 轮询窗口可见性
          │                                       ▼
┌──────────────────── Companion 进程（本插件自带）─────────────────┐
│ 以 DSH 自带 electron.exe 启动（清除 ELECTRON_RUN_AS_NODE）        │
│  ├─ Tray 图标 + 菜单：轻量模式开关 / 延迟 / 立即释放 / 状态       │
│  ├─ Watcher：轮询 DSH 主窗口是否「无可见窗口」(跨平台)            │
│  └─ Releaser：隐藏持续 ≥ delay 秒后，按平台策略释放内存           │
└──────────────────────────────────────────────────────────────────┘
```

### 4.1 为什么不把守护逻辑放进 Host 插件自身
- Host 子进程是 `ELECTRON_RUN_AS_NODE`，**不能创建 Tray**（Tray 是 GUI 主进程 API）。
- 因此把「托盘 + 守护」独立成一个最小 Electron 进程；Host 插件只负责启动、下发配置、报告状态。

## 5. 组件设计

### 5.1 Host 插件 `lib/index.js`
- `export const Config = z.object({ enabled: z.boolean().default(true), delaySeconds: z.number().default(30), mode: z.union(['workingset','suspend']).default('workingset'), autoStart: z.boolean().default(true) })`
- `apply(ctx)`：
  - `ctx.inject(['settings'], c => c.settings.configure({ auto:false }, ctx.fiber))` 声明设置命名空间。
  - 读取/创建 `~/.dsh/lightweight-mode.json`（与 Companion 共享）。
  - `spawnCompanion()`：用 `process.execPath`（Electron）启动 `companion/main.js`，env 清掉 `ELECTRON_RUN_AS_NODE`，附加配置。
  - 监听配置变化（settings 变更 / 文件 mtime），下发给 Companion（通过 `process.send` 或写文件 + 信号）。
  - `ctx.effect(() => () => stopCompanion())`：插件卸载/DSH 退出时清理 Companion。
- **非桌面环境降级**：若 `process.execPath` 不是 Electron（纯 CLI），不启动 Companion，仅保留配置文件（守护能力禁用，日志提示）。

### 5.2 Companion 进程 `companion/main.js`
- 单实例锁（`app.requestSingleInstanceLock`）。
- 创建 Tray：图标、tooltip、菜单：
  - 「轻量模式」☑ 开 / ☐ 关
  - 「延迟」子菜单：15s / 30s / 1min / 5min / 自定义
  - 「立即释放内存」
  - 「显示状态」（上次释放时间 / 预计恢复方式）
  - 「打开设置」（唤起 DSH 窗口并定位设置）
  - 「退出 Companion」
- `Watcher`：每 2 秒检测 DSH 主窗口可见性。
  - Windows：`EnumWindows` + `IsWindowVisible`，按 DSH 主进程 PID 过滤（`koffi` FFI 或 powershell `Add-Type`）。
  - macOS：`osascript` 查询进程窗口数 / `CGWindowListCopyWindowInfo`。
  - Linux：`wmctrl -lp` / `xdotool search --pid`。
- 状态机：`active → hidden(t0) → arming(等待 delay) → released → restoring → active`。
- 若在 arming 期间窗口恢复可见 → 取消释放。
- 配置热更新：监听 `~/.dsh/lightweight-mode.json` mtime。

### 5.3 平台释放策略 `companion/platform/*`
| 平台 | 手段 | 效果 | 恢复 |
|---|---|---|---|
| Windows | `EmptyWorkingSet` / `SetProcessWorkingSetSize(-1,-1)` 作用于 renderer+GPU+utility 进程（不动 Host/主进程） | 工作集（任务管理器「内存」）大幅下降，物理内存释放到 standby/pagefile | 系统按需换入，秒级恢复，UI 状态保留 |
| macOS | 对 renderer 进程 `SIGSTOP` 冻结（不发数据给 GPU），可选 `memory_pressure` 提示；GPU 进程不动 | 停止增长并被系统 compressor 压缩；**降幅不如 Windows 明显** | `SIGCONT` 恢复 |
| Linux | `kill -STOP` 冻结 + 尝试 `process_madvise(MADV_PAGEOUT)` | 视内核而定，best-effort | `kill -CONT` |
| 可选深度模式 | （需要主进程能力，**零改下不提供**；仅记录为未来项） | — | — |

> 说明：Windows 是唯一能「真正把物理内存退回系统」的外部手段；macOS/Linux 主要靠「冻结停止增长 + 系统压缩」，请按此预期验收。

### 5.4 Client 设置插件 `lib/client.js`
- `export const inject = ['remote','remote.settings']`
- `apply(ctx)`：`ctx.slots.inject('settings.section', () => ctx.slots.register({ name:'settings.section', id:'lightweight', order: 90, label: () => t('nav'), locale: NS }, LightweightSection))`
- 面板内容：开关、延迟（数字/下拉）、模式（工作集/冻结）、当前状态、手动释放按钮、平台能力提示。
- 读写走 `ctx.remote.settings.describe()/mutate()`，命名空间与 Host `Config` 对齐。

## 6. 数据与配置
- 共享配置文件：`%USERPROFILE%/.dsh/lightweight-mode.json`（即 `$DSH_HOME/lightweight-mode.json`）。
```json
{ "enabled": true, "delaySeconds": 30, "mode": "workingset", "lastReleaseAt": null, "companionPid": 0 }
```
- 不写系统注册表、不改 PATH、不改 DSH 自身配置；卸载即删除本文件与插件目录。

## 7. 安全与故障隔离
- Companion 崩溃不影响 DSH（独立进程；Host 插件只做 supervisor，不 await 其退出）。
- 释放只对 renderer/GPU/utility 进程，**绝不触碰 Host 子进程、绝不 kill**。
- 所有平台 API 调用失败时降级为 no-op 并记录日志，不抛到 DSH。
- 「轻量模式」默认开，但**首次启动不自动释放**，只在检测到真实的「隐藏 ≥ 延迟」后动作。
- 提供「立即恢复」：点击托盘 → Companion 立即恢复被冻结进程。

## 8. 与 DSH 版本的兼容策略
- 插件以 `file:` 依赖装进 profile，DSH 升级不动 `.dsh/`。
- 只依赖公共 API：`settings`（describe/mutate/configure）、`slots`（settings.section）、`client-modules`（dsh.client 声明）。
- `scripts/verify-compat.mjs`：安装后自检（DSH 版本、slot 名、settings remote 存在），不通过则禁用 Client 面板但保留托盘守护。
- `package.json` 的 `peerDependencies` 跟随 DSH 版本号（与仓库现有 `dsh-subagent-antigravity` 一致），升级后一起 bump。

## 9. 验证清单
- [ ] 关窗后 30s：任务管理器 DSH 相关进程「内存」显著下降（Windows 目标 < 150MB 渲染相关）。
- [ ] 点托盘 → 窗口恢复，session 列表、正在运行的 agent 任务不中断。
- [ ] 正在生成内容时关窗，30s 后释放，重开可见任务仍在跑 / 已完成。
- [ ] 设置面板开关实时生效，延迟修改实时生效。
- [ ] 卸载脚本执行后：无托盘图标、无残留进程、配置删除、DSH 正常。
- [ ] DSH 升级到下一个版本后插件仍工作（或自动降级并提示）。

## 10. 待确认（阻塞项）
1. 是否接受「**独立托盘图标**」（无法并入 DSH 原生托盘）。
2. macOS/Linux 的「冻结式」效果（降幅有限）是否可接受；是否只保证 Windows 完整体验。
3. 默认「轻量模式」= 开，还是 = 关（首次需手动开）？

确认后进入实现（第 1 阶段：Host 插件 + Companion + Windows 释放；第 2 阶段：Client 设置面板；第 3 阶段：mac/Linux 适配 + 安装/卸载脚本 + 兼容自检）。

## 11. 实现定稿（路线 A：复用 DSH 托盘 + 最小补丁，可回滚）

- 采用「asar 头部原地替换 + 把 lib/main.js 标记为 unpacked」的最小补丁：
  - 只改 `app.asar` 的 header 区域（保持字节长度不变，用空格补齐），把 `lib/main.js` 条目标记为 `unpacked` 并写入新哈希；
  - 修改后的 `main.js` 放在 `app.asar.unpacked/lib/main.js`（Electron 原生产物读取路径，已在本机实测可读）；
  - 数据区（182MB）完全不动，其他文件哈希不变。
- 备份：`backups/<时间戳>/header.bin` + `main.js.orig`；回滚脚本精确写回头部并删 unpacked 文件。
- 补丁内核（`lib/patch/kernel.js`）注入 `main.js` 末尾：托盘菜单子项、hide 计时、释放/恢复、配置读写、`setInterval` 热加载配置。
- 插件包：`lib/index.js`（host，声明 Config 并把配置镜像到 JSON + 提供 `/dsh-lightweight-mode/config` 路由）、`lib/client.js`（侧边栏设置分区，读写该路由）。
- 依赖：`@deepseek-ai/schemastery`；客户端通过 `ctx.slots` 注册 `settings.section`。
- 已验证（副本）：apply → Electron node 模式读取补丁后 main.js 成功、语法检查通过、verify OK；rollback → 头部还原、读取回到原 main.js、结构一致。
