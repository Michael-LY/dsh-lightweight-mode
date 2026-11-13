# DSH Desktop 0.2.2-rc.3 兼容适配记录

> 基于 `main`，2026-11-13。
> 本轮范围：静态适配 + 真机内核补丁安装 + npm 发布。

## 1. 目标

将 dsh-lightweight-mode（桌面内核补丁 + 侧边栏设置插件）适配并验证到最新 DSH Desktop **0.2.2-rc.3**。

## 2. 环境事实（实测）

- 运行中的 DSH Desktop 版本：**0.2.2-rc.3**（`app.asar` 内根 `package.json` 的 `@deepseek-ai/dsh-desktop` 版本为 `0.2.2-rc.3`）。
- `app.asar` 路径：`C:\\Users\\moyi_\\AppData\\Local\\Programs\\DeepSeek Harness\\resources\\app.asar`。
- `lib/main.js` 原始大小 **848505** 字节。
- asar header：`header_size=5669972`、`json_len=5669961`、数据区 `base=8+header_size=5669980=16+align4(json_len)`、对齐 padding **3 字节**。

## 3. 变更点清单

### 3.1 内核补丁（kernel.js / apply_patch.py 均未改）

- import 锚点 `import { BrowserWindow, Menu, Notification, Tray,` **仍存在**，原锚点**不含** `MenuItem`（全文 `MenuItem` 计数 0）→ `apply_patch.py` 的 needle/repl 仍适用。
- `setContextMenu` 在 `main.js` 中**仅出现 1 次** → 内核托盘 hook 仍适用。
- header 为 4 字节对齐（3 字节 padding），与 rc.2 同型；现行 `apply_patch.py` / `rollback_patch.py` 使用 Chromium Pickle 语义 `base = 8 + header_size = 16 + align4(json_len)` 解析，**无需修改**。

### 3.2 插件清单元数据（`package.json`）

- `version`：`0.1.2` → **`0.1.3`**。
- `dsh.compatibility.dshReleases`：新增 **`0.2.2-rc.3: compatible`**。
- `engines.dsh` / `dsh.engines.dsh`：保持 `>=0.2.0-rc.2 <0.3.0-0`（已覆盖 rc.3）。

### 3.3 文档

- `README.md` 兼容性表：已验证版本与锚点 → `0.2.2-rc.3`（包名更正为 `@deepseek-ai/dsh-desktop`）。
- `AGENTS.md` 第 1 节同步为 `0.2.2-rc.3`。
- 新增本文件 `docs/compat-0.2.2-rc.3.md`。

## 4. 真机安装

- DSH 运行中无法走 `install.ps1`（进程检查 exit 2），按 AGENTS 第 10 节「应急在线更新内核」直接执行 `apply_patch.py` 写入 asar 头部与 unpacked/main.js，`verify_patch.py` 校验 `VERIFY_OK`。
- 实际执行：`PATCH_OK` + `VERIFY_OK`（size **858315**、sha **02f67593d6954b5a1b62525c81c00b987f87e2fc55053a51ffcd45c8eb5a73e9**，备份 `backups/20261113-202422`）。
- **需完全退出并重开 DSH 后才加载新内核**（主进程代码不热重载）。

## 5. 发布

- `pnpm install` 成功（`@deepseek-ai/cordis 4.0.5`、`@deepseek-ai/schemastery 3.18.5`）。
- `npm publish` 成功：**`dsh-lightweight-mode@0.1.3`**（账号 mokngai，8 files，tag latest）。

## 6. 验收标准

- rc.3 `main.js` 静态锚点核对通过（锚点存在、不含 MenuItem、setContextMenu 唯一）。
- `package.json` 的 `dshReleases` 含 `0.2.2-rc.3` 且 `engines.dsh` 覆盖 rc.3。
- `README.md` / `AGENTS.md` 无残留 rc.2 适配描述。
- `node --check` 全部通过；`verify_patch.py` 输出 `VERIFY_OK`；npm 发布成功。
