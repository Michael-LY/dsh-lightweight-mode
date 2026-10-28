# dsh-lightweight-mode

DSH Desktop（DeepSeek Harness 桌面端）的「轻量模式」套件：关闭窗口到托盘后，等待指定延迟自动释放界面渲染内存，只保留 DSH 核心运行时（Host 进程与正在运行的 AI 会话不受任何干扰）；点击托盘图标或使用快捷键呼出时瞬间恢复。

本仓库由两部分紧密组成：
1. **桌面内核补丁**（路线 A）：向 `app.asar/lib/main.js` 注入主进程轻量化内核，复用 **DSH 原生托盘菜单** 增加「轻量模式」控制项（支持右键动态实时刷新状态）。只新增一个 `app.asar.unpacked/lib/main.js`，并重写 asar 头部元数据将其标记为 `unpacked`；**asar 数据区其他文件完全不动**，且支持一键无损回滚。
2. **DSH 侧边栏设置插件**：深度对齐 DSH 桌面端原生 Design Token 与视觉规范，在侧边栏「设置」中提供现代化的「轻量模式」配置面板，与托盘/内核共享同一份配置文件。

---

## 界面与功能特性

- 🎨 **原生设计规范**：完全融入 DSH 官方 UI 体系，支持自动适配深色（Dark）与浅色（Light）模式。
- 🟢 **状态实时感知**：面板顶部配备动态状态微光徽标，直观展示当前是否就绪运行。
- ⚡ **现代化交互控件**：
  - **无障碍 Switch 开关**：轻触即开即关，具有平滑触控动画。
  - **延迟快捷分段按钮**：提供 `15 秒`、`30 秒`、`1 分钟`、`5 分钟` 常用档位一键设定，亦支持自定义秒数输入微调（5–3600 秒）。
  - **策略下拉选择**：清晰标注自动推荐、工作集裁剪与进程挂起。
  - **使用说明卡片**：集成托盘联动、极速唤醒原理与后台任务安全保障等提示。
  - **快捷操作底栏**：支持配置保存（带成功反馈提示）与一键恢复默认。
- 🌐 **完备的多语言支持**：原生中英文自适应，侧边栏导航条目规范显示为 **「轻量模式」**（英文环境 **「Lightweight Mode」**）。

---

## 工作原理

1. **窗口监听**：主进程补丁监听主窗口 `hide` 事件（点击窗口关闭按钮或快捷键隐藏到托盘），启动计时器（默认 30 秒）。
2. **内存释放**：计时结束且窗口仍处于隐藏状态时触发释放：
   - **Windows**：对 Tab / GPU / Utility 渲染进程调用 Windows API `EmptyWorkingSet`，将渲染工作集物理内存立即写出至页面文件，任务管理器中内存占用大幅骤降；进程维持存活，后台 Session 不会断开。
   - **macOS / Linux**：对渲染相关子进程发送 `SIGSTOP` 信号挂起（停止 CPU 轮询与内存扩张，交由系统内存压缩机制回收）。
3. **极速唤醒**：当窗口触发 `show` 或 `focus` 时，取消定时器并按需瞬间换入恢复（POSIX 发送 `SIGCONT`），用户体验无缝连贯。
4. **统一配置中心**：配置持久化于 `~/.dsh/lightweight-mode.json`，系统托盘菜单与侧边栏设置面板双向实时同步。

---

## 配置字段说明

配置文件路径：`~/.dsh/lightweight-mode.json`（支持通过环境变量 `DSH_HOME` 自定义目录）。

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `enabled` | boolean | `true` | 是否启用轻量模式内存释放 |
| `delaySeconds` | number | `30` | 窗口隐藏到托盘后等待多久释放（范围 5–3600 秒） |
| `mode` | string | `"auto"` | 释放机制：`"auto"`（推荐，Win走工作集/其他走挂起）、`"workingset"`、`"suspend"` |

---

## 安装与部署

> **前置依赖**：系统需安装 **Python 3**（用于执行精确 asar 补丁读写脚本）与 PowerShell 5+。
> **特别注意**：执行安装、卸载或更新操作前，**必须先完全退出 DSH Desktop**（右键托盘图标 → Quit）。

### 1. 安装桌面内核补丁

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

* 脚本会自动备份原 `app.asar` 头部及 `main.js` 到 `backups/<时间戳>/`，完成补丁注入并生成校验。
* 启动 DSH Desktop 即可在托盘菜单看到轻量模式控制项。

### 2. 安装侧边栏设置插件（推荐）

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-plugin.ps1
```

* 脚本会将插件信息写入 profile 的 `package.json`，并在 `node_modules` 自动建立目录链接（Junction，无需额外依赖联网下载）。
* 启动 DSH 后，侧边栏「设置」中将出现崭新的「轻量模式」面板。
* *若已安装过插件，修改前端代码后只需在 DSH 窗口按 <kbd>Ctrl</kbd> + <kbd>R</kbd> 即可热刷新生效。*

---

## 卸载与无损回滚

### 回滚内核补丁

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall.ps1
```
* 从备份目录精准恢复原 `app.asar` 头部并移除解包文件，完全恢复官方初始状态。

### 卸载设置插件

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-plugin.ps1
```

---

## 平台表现对比

| 平台 | 底层机制 | 内存回收效果 | 恢复速度 |
|---|---|---|---|
| **Windows** | `EmptyWorkingSet` | 显著释放渲染与 GPU 进程工作集（降幅通常达几百 MB 至数 GB） | 系统按需秒级换入，无缝唤醒 |
| **macOS / Linux** | `SIGSTOP` 冻结 | 阻止进程无谓占用 CPU 及扩展内存，依赖系统内存压缩 | 发送 `SIGCONT`，瞬间恢复 |

---

## 调试与验证工具

仓库提供了一系列便捷的测试验证脚本：

```powershell
# 实时监测各 DSH 进程的物理工作集内存占用变化（默认持续 60 秒）
powershell -ExecutionPolicy Bypass -File .\scripts\measure.ps1 -Seconds 60

# 查看当前系统上可见的 DSH 窗口句柄与状态
powershell -ExecutionPolicy Bypass -File .\scripts\winstate.ps1

# 校验当前 app.asar 补丁的完整性与哈希一致性
python scripts\verify_patch.py --asar "<app.asar 路径>"
```
