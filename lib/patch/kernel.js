/* ===== dsh-lightweight-mode kernel v1 (auto-injected; do not edit) ===== */
const __lm = (() => {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh');
  const configPath = join(home, 'lightweight-mode.json');
  const logPath = join(home, 'lightweight-mode.log');
  const DEFAULTS = { enabled: true, delaySeconds: 30, mode: 'auto' };
  let config = Object.assign({}, DEFAULTS);
  let timer = null;
  let released = false;
  let suspended = [];
  let lastReleaseAt = 0;
  let lastMode = '';
  try { mkdirSync(home, { recursive: true }); } catch (e) {}
  function log() {
    try {
      const parts = [];
      for (let i = 0; i < arguments.length; i++) parts.push(String(arguments[i]));
      appendFileSync(logPath, new Date().toISOString() + ' ' + parts.join(' ') + '\n');
    } catch (e) {}
  }
  function readConfig() {
    try {
      if (existsSync(configPath)) {
        let raw = readFileSync(configPath, 'utf8');
        if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
        const v = JSON.parse(raw);
        if (v && typeof v === 'object') config = Object.assign({}, DEFAULTS, v);
      }
    } catch (e) { log('read config failed', e && e.message); }
    if (typeof config.delaySeconds !== 'number' || !(config.delaySeconds >= 5)) config.delaySeconds = DEFAULTS.delaySeconds;
    return config;
  }
  function writeConfig(patch) {
    readConfig();
    config = Object.assign({}, config, patch);
    try {
      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      log('config written', JSON.stringify(config));
    } catch (e) { log('write config failed', e && e.message); }
    return config;
  }
  function metricsPids(types) {
    try {
      return app.getAppMetrics().filter(function (m) { return types.indexOf(m.type) >= 0; }).map(function (m) { return m.pid; }).filter(Boolean);
    } catch (e) { log('metrics failed', e && e.message); return []; }
  }
  function trimWindows(pids) {
    if (!pids.length) return;
    const script = "$ErrorActionPreference='SilentlyContinue'\n" +
      "Add-Type -Namespace LmNative -Name Mem -MemberDefinition '[DllImport(\"psapi.dll\")] public static extern bool EmptyWorkingSet(IntPtr h);[DllImport(\"kernel32.dll\")] public static extern IntPtr OpenProcess(int a,bool b,int c);[DllImport(\"kernel32.dll\")] public static extern bool CloseHandle(IntPtr h);'\n" +
      "foreach($p in @(" + pids.join(',') + ")){ $h=[LmNative.Mem]::OpenProcess(0x1F0FFF,$false,[int]$p); if($h -ne [IntPtr]::Zero){ [void][LmNative.Mem]::EmptyWorkingSet($h); [void][LmNative.Mem]::CloseHandle($h) } }\n";
    try {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '-'], { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] });
      child.on('error', function (e) { log('trim spawn error', e && e.message); });
      child.stdin.write(script);
      child.stdin.end();
      log('trim dispatched', pids.join(','));
    } catch (e) { log('trim failed', e && e.message); }
  }
  function suspendPosix(pids) {
    const frozen = [];
    for (let i = 0; i < pids.length; i++) {
      try { process.kill(pids[i], 'SIGSTOP'); frozen.push(pids[i]); } catch (e) { log('stop failed', pids[i], e && e.message); }
    }
    suspended = frozen;
    log('suspended', frozen.join(','));
  }
  function resumePosix() {
    for (let i = 0; i < suspended.length; i++) { try { process.kill(suspended[i], 'SIGCONT'); } catch (e) {} }
    if (suspended.length) log('resumed', suspended.join(','));
    suspended = [];
  }
  function release() {
    readConfig();
    const mode = config.mode === 'auto' ? (process.platform === 'win32' ? 'workingset' : 'suspend') : config.mode;
    if (mode === 'workingset') {
      if (process.platform === 'win32') {
        trimWindows(metricsPids(['Tab', 'GPU', 'Utility']));
        setTimeout(function () { trimWindows(metricsPids(['Tab', 'GPU', 'Utility'])); }, 3000);
        setTimeout(function () { trimWindows(metricsPids(['Tab', 'GPU', 'Utility'])); }, 8000);
      } else { suspendPosix(metricsPids(['Tab', 'Utility'])); }
    } else {
      suspendPosix(metricsPids(['Tab', 'Utility']));
    }
    released = true; lastReleaseAt = Date.now(); lastMode = mode;
    log('released', mode);
  }
  function restore() {
    if (suspended.length) resumePosix();
    released = false;
  }
  function isPrimary(win) {
    try { return !!(win && win.webContents && !win.webContents.isDestroyed() && String(win.webContents.getURL() || '').indexOf('dsh-app://app/') === 0); } catch (e) { return false; }
  }
  function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }
  function primaryWindow() {
    try {
      const all = BrowserWindow.getAllWindows();
      for (let i = 0; i < all.length; i++) { if (isPrimary(all[i])) return all[i]; }
    } catch (e) {}
    return undefined;
  }
  function schedule(win) {
    readConfig();
    if (!config.enabled) return;
    if (!isPrimary(win)) return;
    clearTimer();
    const delay = Math.max(5, Number(config.delaySeconds) || 30) * 1000;
    timer = setTimeout(function () {
      timer = null;
      try {
        if (config.enabled && win && !win.isDestroyed() && !win.isVisible() && isPrimary(win)) release();
      } catch (e) { log('scheduled release error', e && e.message); }
    }, delay);
    log('scheduled', delay);
  }
  function appendItems(menu) {
    readConfig();
    const delays = [15, 30, 60, 300];
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({ label: '轻量模式', type: 'checkbox', checked: !!config.enabled, click: function (item) { writeConfig({ enabled: !!item.checked }); if (!item.checked) { clearTimer(); restore(); } } }));
    const delayTpl = [];
    for (let i = 0; i < delays.length; i++) {
      (function (s) {
        delayTpl.push({ label: s < 60 ? (s + ' 秒') : ((s / 60) + ' 分钟'), type: 'radio', checked: Number(config.delaySeconds) === s, click: function () { writeConfig({ delaySeconds: s }); } });
      })(delays[i]);
    }
    menu.append(new MenuItem({ label: '轻量模式延迟', submenu: Menu.buildFromTemplate(delayTpl) }));
    menu.append(new MenuItem({ label: released ? '立即恢复界面内存' : '立即释放界面内存', click: function () {
      try {
        const win = primaryWindow();
        if (win && win.isVisible()) win.hide();
        release();
      } catch (e) { log('manual release error', e && e.message); }
    } }));
    menu.append(new MenuItem({ label: released ? ('状态：已释放（' + lastMode + '）') : '状态：未释放', enabled: false }));
  }
  try {
    if (!Tray.prototype.__lmPatched) {
      Tray.prototype.__lmPatched = true;
      const orig = Tray.prototype.setContextMenu;
      Tray.prototype.setContextMenu = function (menu) {
        try {
          if (menu && typeof menu.append === 'function' && !menu.__lmPatched) {
            menu.__lmPatched = true;
            appendItems(menu);
          }
        } catch (e) { log('tray patch failed', e && e.message); }
        return orig.call(this, menu);
      };
    }
  } catch (e) { log('tray prototype patch failed', e && e.message); }
  try {
    app.on('browser-window-created', function (_e, win) {
      try {
        win.on('hide', function () { if (isPrimary(win)) schedule(win); });
        win.on('show', function () { clearTimer(); restore(); });
        win.on('focus', function () { clearTimer(); restore(); });
        win.on('closed', function () { clearTimer(); restore(); });
      } catch (e) { log('hook window failed', e && e.message); }
    });
  } catch (e) { log('window hook failed', e && e.message); }
  try {
    const iv = setInterval(function () {
      const before = JSON.stringify(config);
      readConfig();
      if (!config.enabled) { clearTimer(); if (released) restore(); }
      if (JSON.stringify(config) !== before) log('config reloaded', JSON.stringify(config));
    }, 5000);
    if (iv && typeof iv.unref === 'function') iv.unref();
  } catch (e) {}
  readConfig();
  log('kernel loaded', JSON.stringify(config));
  return { readConfig: readConfig, writeConfig: writeConfig, release: release, restore: restore, schedule: schedule, state: function () { return { released: released, lastReleaseAt: lastReleaseAt, lastMode: lastMode, config: config }; } };
})();
try { globalThis.__DSH_LIGHTWEIGHT_MODE__ = __lm; } catch (e) {}
/* ===== end dsh-lightweight-mode kernel ===== */