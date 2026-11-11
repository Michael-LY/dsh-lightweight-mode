# DSH Desktop 0.2.2-rc.2 兼容适配记录

> 分支：`compat/dsh-0.2.2-rc.2`（基于 `main`）
> 范围：仅做**静态适配 + 脚本级校验**。DSH 仍在运行，本轮禁止真机安装、禁止写 `app.asar`。

## 1. 目标

将 dsh-lightweight-mode（桌面内核补丁 + 侧边栏设置插件）适配并验证到最新 DSH Desktop **0.2.2-rc.2**。

已确认的运行环境事实：

- 运行中的 DSH Desktop 版本：**0.2.2-rc.2**
- `@deepseek-ai/dsh-desktop-runtime` 版本：**0.2.2-rc.2**
- 安装目录中 `version` 文件记录的是 **Electron 44.7.0**，**不是** DSH 版本，勿混淆
- `app.asar` 路径：`C:\Users\moyi_\AppData\Local\Programs\DeepSeek Harness\resources\app.asar`

## 2. 变更点清单

### 2.1 内核补丁锚点与脚本（静态核对；kernel.js 未改，apply_patch.py / rollback_patch.py 已修复 asar 头对齐）

- rc.2 `main.js` 大小约 **848505** 字节。
- import 注入锚点 `import { BrowserWindow, Menu, Notification, Tray,` **仍存在**，且原锚点**不含 `MenuItem`** → `scripts/apply_patch.py` 的 needle/repl 仍适用。
- `Tray.prototype.setContextMenu` 在 `tray.setContextMenu(Menu.buildFromTemplate([...]))` 处出现 **1 次** → kernel 的托盘 hook 仍适用。
- 结论：`lib/patch/kernel.js` **未改动**（锚点与 hook 仍适用）。但 rc.2 的 asar header 存在 **4 字节对齐 padding**，旧公式 `base = 16 + json_len` 会偏移 **3 字节**读坏 `main.js`（rc.2 的 `header_size = 5660816`，而 `16 + json_len = 5660821`）；故 `scripts/apply_patch.py` 与 `scripts/rollback_patch.py` 已修复为按 **Chromium Pickle 语义** 解析：`data base = 8 + header_size = 16 + align4(json_len)`（新增 `align4()`），并备份/回写完整 header 区（`pre + json + padding = 8 + header_size` 字节）；`rollback_patch.py` 同时兼容全量（`8 + header_size`）与旧式（`16 + json_len`）长度。

### 2.2 插件清单元数据（`package.json`，由 coder 负责）

- `engines.dsh` = `>=0.2.0-rc.2 <0.3.0-0`，**已覆盖** 0.2.2-rc.2（`engines.dsh` 与 `dsh.engines.dsh` 两处一致）。
- `dsh.compatibility.dshReleases` 现记录 `0.2.0-rc.2`、`0.2.1-rc.5`、`0.2.2-rc.1`、`0.2.2-rc.2: compatible`；其中 **`0.2.2-rc.2: compatible` 为本轮已新增**。
- `version` = `0.1.2`（本轮已升 patch 级，由 `0.1.1` → `0.1.2`）。
- 注：本节为计划，`package.json` 的实际编辑由 coder 执行，**planner 不直接改 `package.json`**。

### 2.3 文档（由 planner 负责）

- `README.md`：兼容性表的「已验证的 DSH Desktop」「内核补丁锚点」由 `0.2.2-rc.1` → `0.2.2-rc.2`。
- `AGENTS.md`：第 1 节「当前适配并验证的 DSH Desktop 版本」由 `0.2.2-rc.1` → `0.2.2-rc.2`。
- 新增本文件 `docs/compat-0.2.2-rc.2.md`。

## 3. 验证口径

### 3.1 静态验证

- 确认 rc.2 `main.js` 中存在 import 锚点 `import { BrowserWindow, Menu, Notification, Tray,` 且**不含** `MenuItem`。
- 确认 `Tray.prototype.setContextMenu` 出现且**仅出现 1 次**（位于 `tray.setContextMenu(Menu.buildFromTemplate([...]))`）。
- 确认 `package.json` 兼容范围覆盖 0.2.2-rc.2，且 `dshReleases` 含 `0.2.2-rc.2`。

### 3.2 脚本级校验（不接触真机、不写 `app.asar`）

- 对 `scripts/apply_patch.py` 的锚点匹配逻辑做**只读**核对，确认其能命中 rc.2 `main.js`（不实际写入 `app.asar`）。
- Node 语法校验：`node --check lib/index.js`、`node --check lib/client.js`、`node --check lib/patch/kernel.js`。
- Python 语法校验：`python -m py_compile scripts/apply_patch.py scripts/verify_patch.py scripts/rollback_patch.py`。
- 说明：`scripts/install.ps1` / `scripts/uninstall.ps1` 因 DSH 进程检查会以 **exit code 2** 退出，本轮**不执行**真机安装，故不以这两个脚本作为通过条件。

### 3.3 工具路径

- python：`C:\Users\moyi_\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe`
- node：`C:\Users\moyi_\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`

### 3.4 禁止项

- 禁止真机安装（`install.ps1` / `install-plugin.ps1`）。
- 禁止写 `app.asar`、禁止生成 `app.asar.unpacked`。
- 禁止 `commit` / `push`，禁止触碰 `*.tgz`。

## 4. 未做项（待用户执行）

- **真机安装与真机验证**：需用户**完全退出 DSH Desktop** 后自行执行 `scripts\install.ps1`（必要时再执行 `install-plugin.ps1`），并用 `scripts\verify_patch.py` 校验输出 `VERIFY_OK`，重启 DSH 后观察托盘菜单与内存释放效果。
- 本分支改动未提交、未推送。

## 5. 验收标准

- rc.2 `main.js` 静态锚点核对通过：锚点存在、不含 `MenuItem`、`setContextMenu` 唯一。
- `lib/patch/kernel.js` 无需修改；`scripts/apply_patch.py` / `scripts/rollback_patch.py` 已修复 asar header 4 字节对齐（Chromium Pickle 语义，`base = 8 + header_size = 16 + align4(json_len)`），并在只读校验中确认正确。
- `package.json` 的 `dshReleases` 含 `0.2.2-rc.2`，且 `engines.dsh` 覆盖 0.2.2-rc.2。
- `README.md` / `AGENTS.md` 无残留「0.2.2-rc.1」适配/验证描述，均已更新为 `0.2.2-rc.2`。
- 脚本级校验通过：`node --check` 与 `py_compile` 全部无错误。
- 全程未写 `app.asar`、未真机安装、未 commit/push、未触碰 `*.tgz`。
