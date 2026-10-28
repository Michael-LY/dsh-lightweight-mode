# dsh-lightweight-mode

DSH Desktop 的「轻量模式」插件：关闭窗口到托盘后，等待一段时间释放界面渲染内存，只保留 dsh 核心运行时（Host 进程与正在运行的 session 不中断）；点击托盘图标重新打开时界面恢复。

本仓库包含两部分：
1. **桌面内核补丁**（路线 A）：给 `app.asar/lib/main.js` 注入一段内核，复用 **DSH 原生托盘菜单** 增加「轻量模式」子菜单。补丁只新增一个 `app.asar.unpacked/lib/main.js`（原文件 + 注入的内核），并重写 asar 头部元数据把该条目标记为 `unpacked`（更新 size/integrity），同时在 import 中补入 `MenuItem`；**asar 数据区其他文件不动、不移动数据区**，且可一键回滚。
2. **DSH 插件包**：在侧边栏「设置」里增加「轻量模式」面板，读写 `~/.dsh/lightweight-mode.json`。

## 工作原理

- 主进程补丁监听主窗口 `hide` 事件（关闭按钮 → 隐藏到托盘），启动计时（默认 30s）。
- 计时结束且窗口仍隐藏 → 释放：
  - Windows：对 renderer / GPU / utility 进程调用 `EmptyWorkingSet`（工作集释放到页面文件，任务管理器内存显著下降；进程仍在，session 不中断）。
  - macOS / Linux：对 renderer/utility 进程发 `SIGSTOP` 冻结（停止增长，交给系统压缩）；窗口重新显示时 `SIGCONT`。
- 窗口 `show`/`focus` 时立即恢复并取消计时。
- 配置存 `~/.dsh/lightweight-mode.json`；托盘菜单与设置面板共享该文件。

## 配置

`~/.dsh/lightweight-mode.json`（可用环境变量 `DSH_HOME` 覆盖目录），三个字段：
- `enabled`：是否启用（默认 `true`）
- `delaySeconds`：隐藏后等待多少秒释放（默认 `30`，范围 5–3600）
- `mode`：`auto`（默认，Windows 用工作集裁剪、其余用冻结）/ `workingset` / `suspend`

## 安装（需先完全退出 DSH Desktop）

> 前置依赖：**Python 3**（内核补丁脚本 `apply_patch.py` / `verify_patch.py` / `rollback_patch.py` 均通过 `python` 命令调用）与 Windows PowerShell 5+。默认 asar 路径见脚本内 `-Asar` 参数，必要时覆盖。

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

脚本会：检查 DSH 未运行 → 备份原 `app.asar` 头部与 `main.js` 到 `backups/<时间戳>/` → 打补丁 → 校验 → 写入默认配置。
重新启动 DSH Desktop 生效。

### 安装设置面板插件（可选，用于侧边栏设置页）

需要先完全退出 DSH Desktop，然后：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-plugin.ps1
```

脚本会：备份 profile 的 `package.json` → 加入 `dsh-lightweight-mode` 依赖与 `dsh.profile.bundles` → 在 `node_modules` 建立目录 junction（不需要 pnpm/联网）。重启 DSH 后，设置里出现「轻量模式」分区。

卸载：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-plugin.ps1
```

> 未装插件也能用托盘菜单；面板只是把同一份 `~/.dsh/lightweight-mode.json` 用图形界面编辑。

> 即使不装插件，补丁 + 托盘菜单也能独立工作（配置可直接编辑 `~/.dsh/lightweight-mode.json`）。

## 回滚

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall.ps1
```

从 `backups/<时间戳>/header.bin` 恢复 asar 头部，并删除 `app.asar.unpacked/lib/main.js`。数据区从未被改动，回滚是精确还原。

## 托盘菜单
托盘图标右键菜单新增：
- 轻量模式（勾选开关）
- 轻量模式延迟（15 秒 / 30 秒 / 1 分钟 / 5 分钟）
- 立即释放界面内存 / 立即恢复界面内存
- 状态：已释放 / 未释放

## 平台说明
| 平台 | 方式 | 释放效果 | 恢复 |
|---|---|---|---|
| Windows | EmptyWorkingSet | 工作集/物理内存显著下降 | 系统按需换入，秒回 |
| macOS / Linux | SIGSTOP 冻结 | 停止增长，系统压缩；降幅有限 | SIGCONT，秒回 |

## 已知限制
- 释放由主进程内核触发（工作集回收 / 冻结），renderer / GPU 进程仍存在，session 与 UI 状态保留。
- 若 DSH 升级替换了 `app.asar`，补丁会失效，需要重新运行 `install.ps1`（回滚锚点仍在 `backups/`）。
- 设置面板为可选插件；未装插件时用托盘菜单或编辑 JSON。