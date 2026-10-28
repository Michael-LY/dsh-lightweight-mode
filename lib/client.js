window.__ModuleLoader__.load({ id: "dsh-lightweight-mode", factory: (require) => {
  var module = { exports: {} };
  var exports = module.exports;
  var React = require("react");
  var h = React.createElement;
  var NS = "dsh-lightweight-mode";
  var inject = ["slots", "locale"];

  var zh = {
    title: "轻量模式",
    nav: "轻量模式",
    desc: "窗口最小化或关闭到托盘后，释放前端界面绘制与渲染内存，保持后台会话与长任务不中断。",
    enabledTitle: "启用轻量模式",
    enabledDesc: "窗口隐藏到系统托盘后开始计时，超时仍未唤醒则自动释放界面内存",
    delayTitle: "释放延迟",
    delayDesc: "窗口关闭或隐藏到托盘后等待多久释放内存（防止误触与频繁切换）",
    delayUnit: "秒",
    delayPreset15: "15 秒",
    delayPreset30: "30 秒",
    delayPreset60: "1 分钟",
    delayPreset300: "5 分钟",
    modeTitle: "回收策略",
    modeDesc: "界面内存释放的系统层处理方式",
    modeAuto: "自动选择（推荐）",
    modeWorkingset: "工作集裁剪 (EmptyWorkingSet)",
    modeSuspend: "进程挂起 (SIGSTOP)",
    statusActive: "已启用",
    statusDisabled: "已停用",
    save: "保存设置",
    saved: "设置已保存",
    saving: "正在保存…",
    reset: "恢复默认",
    tipTitle: "功能说明与提示",
    tip1: "系统托盘联动：右键系统托盘中的 DeepSeek 图标，可随时调整延迟或点击「立即释放界面内存」。",
    tip2: "无感极速唤醒：点击托盘图标或使用快捷键呼出窗口时，界面工作集将瞬间按需恢复。",
    tip3: "会话长任务安全：仅释放前端 UI 渲染内存，后台 Host 服务与进行中的 AI 会话不受任何影响。"
  };

  var en = {
    title: "Lightweight Mode",
    nav: "Lightweight Mode",
    desc: "Release UI rendering memory when the window is hidden to tray while keeping background sessions alive.",
    enabledTitle: "Enable Lightweight Mode",
    enabledDesc: "Start timer after hiding to tray; trim UI memory if window remains hidden after timeout",
    delayTitle: "Release Delay",
    delayDesc: "Time to wait before trimming memory (prevents accidental triggers during quick switches)",
    delayUnit: "seconds",
    delayPreset15: "15s",
    delayPreset30: "30s",
    delayPreset60: "1m",
    delayPreset300: "5m",
    modeTitle: "Memory Strategy",
    modeDesc: "Operating system memory reclamation mechanism",
    modeAuto: "Auto (Recommended)",
    modeAutoDesc: "Windows: Trim working set; macOS/Linux: Suspend rendering processes",
    modeWorkingset: "Working Set Trimming (EmptyWorkingSet)",
    modeSuspend: "Process Suspend (SIGSTOP)",
    statusActive: "Active",
    statusDisabled: "Disabled",
    save: "Save Changes",
    saved: "Saved",
    saving: "Saving…",
    reset: "Reset to Defaults",
    tipTitle: "How It Works",
    tip1: "Tray Menu Sync: Right-click the DSH tray icon to toggle, adjust delay, or release memory immediately.",
    tip2: "Seamless Restore: Restores working set on demand the instant the window is shown or focused.",
    tip3: "Session Safety: Only affects UI renderer and tabs; host background agent sessions remain fully intact."
  };

  var ctxRef = null;

  function isZh() {
    try {
      if (ctxRef && ctxRef.locale && typeof ctxRef.locale.getSnapshot === "function") {
        var snap = ctxRef.locale.getSnapshot();
        if (snap && snap.active) return snap.active.toLowerCase().indexOf("zh") >= 0;
      }
    } catch (e) {}
    try {
      if (typeof navigator !== "undefined" && navigator.language) {
        return navigator.language.toLowerCase().indexOf("zh") >= 0;
      }
    } catch (e) {}
    return true;
  }

  function t(key) {
    try {
      if (ctxRef && ctxRef.locale && typeof ctxRef.locale.bind === "function") {
        var val = ctxRef.locale.bind(NS)(key);
        if (val && val !== key && val !== "nav") return val;
      }
    } catch (e) {}
    var dict = isZh() ? zh : en;
    return dict[key] || (isZh() ? zh[key] : en[key]) || key;
  }

  var CSS_SNIPPET = [
    ".dsh-lm-wrap{display:flex;flex-direction:column;gap:18px;width:100%;max-width:740px;box-sizing:border-box;font-family:inherit;color:var(--dsw-alias-label-primary,inherit);animation:dsh-lm-fadein .18s ease-out}",
    "@keyframes dsh-lm-fadein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}",
    ".dsh-lm-header{display:flex;flex-direction:column;gap:8px;padding:2px 2px 4px}",
    ".dsh-lm-title-row{display:flex;align-items:center;gap:12px}",
    ".dsh-lm-title{font-size:18px;font-weight:600;line-height:24px;color:var(--dsw-alias-label-primary,inherit);letter-spacing:-0.01em}",
    ".dsh-lm-status-badge{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:500;line-height:16px;border:1px solid transparent;transition:all .2s ease}",
    ".dsh-lm-badge-active{background:rgba(16,185,129,.12);color:#10b981;border-color:rgba(16,185,129,.25)}",
    ".dsh-lm-badge-disabled{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));color:var(--dsw-alias-label-tertiary,#888);border-color:var(--dsw-alias-border-l2,rgba(127,127,127,.18))}",
    ".dsh-lm-badge-dot{width:6px;height:6px;border-radius:50%;background:currentColor}",
    ".dsh-lm-badge-active .dsh-lm-badge-dot{box-shadow:0 0 6px rgba(16,185,129,.6)}",
    ".dsh-lm-desc{font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary,#8a8f98);margin:0}",
    ".dsh-lm-card{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.18));border-radius:14px;background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.04));overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04)}",
    ".dsh-lm-row{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:16px 20px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.12));transition:background .12s ease}",
    ".dsh-lm-row:last-child{border-bottom:none}",
    ".dsh-lm-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.03))}",
    ".dsh-lm-row-info{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}",
    ".dsh-lm-row-title{font-size:14px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary,inherit)}",
    ".dsh-lm-row-desc{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#8a8f98)}",
    ".dsh-lm-switch{position:relative;display:inline-flex;align-items:center;width:42px;height:24px;border-radius:12px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.25));background:var(--dsw-alias-fill-secondary,rgba(127,127,127,.22));padding:0;cursor:pointer;flex:none;transition:background .2s cubic-bezier(0.4,0,0.2,1),border-color .2s ease;outline:none}",
    ".dsh-lm-switch:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-button-primary-fill,#4c8dff)}",
    ".dsh-lm-switch[aria-checked='true']{background:var(--dsw-alias-button-primary-fill,#4c8dff);border-color:var(--dsw-alias-button-primary-fill,#4c8dff)}",
    ".dsh-lm-switch-thumb{position:absolute;left:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#ffffff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .2s cubic-bezier(0.4,0,0.2,1)}",
    ".dsh-lm-switch[aria-checked='true'] .dsh-lm-switch-thumb{transform:translateX(18px)}",
    ".dsh-lm-delay-ctrl{display:flex;align-items:center;gap:10px;flex:none}",
    ".dsh-lm-seg{display:inline-flex;align-items:center;padding:3px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.15));gap:2px}",
    ".dsh-lm-seg-btn{border:none;background:transparent;color:var(--dsw-alias-label-secondary,inherit);font-size:12px;font-weight:500;padding:4px 9px;border-radius:6px;cursor:pointer;transition:all .15s ease;white-space:nowrap}",
    ".dsh-lm-seg-btn:hover{color:var(--dsw-alias-label-primary,inherit)}",
    ".dsh-lm-seg-btn[data-active='true']{background:var(--dsw-alias-bg-layer-1,#ffffff);color:var(--dsw-alias-label-primary,#111827);box-shadow:0 1px 3px rgba(0,0,0,.1)}",
    "@media (prefers-color-scheme: dark){.dsh-lm-seg-btn[data-active='true']{background:var(--dsw-alias-bg-layer-3,#2a2e37);color:#f3f4f6}}",
    ".dsh-lm-input-wrap{display:inline-flex;align-items:center;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.22));border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));padding:0 8px 0 0;overflow:hidden;height:30px;box-sizing:border-box}",
    ".dsh-lm-input{border:none;background:transparent;color:var(--dsw-alias-label-primary,inherit);font-size:13px;font-weight:500;width:48px;padding:0 6px 0 10px;height:100%;outline:none;box-sizing:border-box;text-align:right;font-variant-numeric:tabular-nums}",
    ".dsh-lm-input-unit{font-size:12px;color:var(--dsw-alias-label-tertiary,#888);user-select:none;padding-left:2px}",
    ".dsh-lm-select{appearance:none;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.22));border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));color:var(--dsw-alias-label-primary,inherit);font-size:13px;padding:6px 32px 6px 12px;outline:none;cursor:pointer;background-image:url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%23888888\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"6 9 12 15 18 9\"></polyline></svg>');background-repeat:no-repeat;background-position:right 10px center;transition:border-color .15s ease}",
    ".dsh-lm-select:hover{border-color:var(--dsw-alias-label-dimmed,rgba(128,128,128,.4))}",
    ".dsh-lm-tip-card{display:flex;flex-direction:column;gap:10px;padding:16px 18px;border-radius:12px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.05));border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.12))}",
    ".dsh-lm-tip-header{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary,inherit)}",
    ".dsh-lm-tip-list{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}",
    ".dsh-lm-tip-item{display:flex;align-items:flex-start;gap:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#888)}",
    ".dsh-lm-tip-dot{color:var(--dsw-alias-button-primary-fill,#4c8dff);font-weight:bold;flex:none}",
    ".dsh-lm-footer{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:2px}",
    ".dsh-lm-footer-left{display:flex;align-items:center;gap:10px}",
    ".dsh-lm-btn-save{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;padding:0 18px;border-radius:8px;border:1px solid transparent;background:var(--dsw-alias-button-primary-fill,#4c8dff);color:#ffffff;font-size:13px;font-weight:500;cursor:pointer;transition:opacity .15s ease,transform .05s ease}",
    ".dsh-lm-btn-save:hover{opacity:.92}",
    ".dsh-lm-btn-save:active{transform:scale(0.98)}",
    ".dsh-lm-btn-reset{display:inline-flex;align-items:center;min-height:32px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.2));background:transparent;color:var(--dsw-alias-label-secondary,inherit);font-size:13px;cursor:pointer;transition:all .15s ease}",
    ".dsh-lm-btn-reset:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.08));color:var(--dsw-alias-label-primary,inherit)}",
    ".dsh-lm-msg{font-size:12px;display:inline-flex;align-items:center;gap:5px;transition:opacity .2s ease}",
    ".dsh-lm-msg-ok{color:#10b981}",
    ".dsh-lm-msg-err{color:#ef4444}"
  ].join("");

  function ensureStyles() {
    if (typeof document === "undefined") return;
    var STYLE_ID = "dsh-lightweight-mode-style";
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS_SNIPPET;
    document.head.appendChild(style);
  }

  function Section() {
    ensureStyles();

    var state = React.useState(null);
    var cfg = state[0]; var setCfg = state[1];

    var msgState = React.useState({ text: "", type: "ok" });
    var msg = msgState[0]; var setMsg = msgState[1];

    var savingState = React.useState(false);
    var saving = savingState[0]; var setSaving = savingState[1];

    React.useEffect(function () {
      fetch("/dsh-lightweight-mode/config")
        .then(function (r) { return r.json(); })
        .then(function (v) { setCfg(v); })
        .catch(function (e) {
          setMsg({ text: String(e && e.message || e), type: "err" });
        });
    }, []);

    if (!cfg) {
      return h("div", { style: { padding: "24px 20px", color: "var(--dsw-alias-label-tertiary, #888)", fontSize: 13 } }, isZh() ? "加载配置中…" : "Loading settings…");
    }

    function update(patch) {
      setCfg(Object.assign({}, cfg, patch));
    }

    function save() {
      setSaving(true);
      fetch("/dsh-lightweight-mode/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cfg)
      })
        .then(function (r) { return r.json(); })
        .then(function (v) {
          setCfg(v);
          setSaving(false);
          setMsg({ text: t("saved"), type: "ok" });
          setTimeout(function () { setMsg({ text: "", type: "ok" }); }, 3000);
        })
        .catch(function (e) {
          setSaving(false);
          setMsg({ text: String(e && e.message || e), type: "err" });
        });
    }

    function resetDefaults() {
      update({ enabled: true, delaySeconds: 30, mode: "auto" });
    }

    var presets = [
      { sec: 15, label: t("delayPreset15") },
      { sec: 30, label: t("delayPreset30") },
      { sec: 60, label: t("delayPreset60") },
      { sec: 300, label: t("delayPreset300") }
    ];

    return h("div", { className: "dsh-lm-wrap" }, [
      // 头部
      h("div", { key: "header", className: "dsh-lm-header" }, [
        h("div", { className: "dsh-lm-title-row" }, [
          h("div", { className: "dsh-lm-title" }, t("title")),
          h("div", {
            className: "dsh-lm-status-badge " + (cfg.enabled ? "dsh-lm-badge-active" : "dsh-lm-badge-disabled")
          }, [
            h("span", { key: "dot", className: "dsh-lm-badge-dot" }),
            h("span", { key: "txt" }, cfg.enabled ? t("statusActive") : t("statusDisabled"))
          ])
        ]),
        h("p", { className: "dsh-lm-desc" }, t("desc"))
      ]),

      // 配置卡片
      h("div", { key: "card", className: "dsh-lm-card" }, [
        // 行 1: 启用开关
        h("div", { key: "row-enabled", className: "dsh-lm-row" }, [
          h("div", { className: "dsh-lm-row-info" }, [
            h("div", { className: "dsh-lm-row-title" }, t("enabledTitle")),
            h("div", { className: "dsh-lm-row-desc" }, t("enabledDesc"))
          ]),
          h("button", {
            type: "button",
            role: "switch",
            "aria-checked": !!cfg.enabled,
            className: "dsh-lm-switch",
            onClick: function () { update({ enabled: !cfg.enabled }); }
          }, [
            h("span", { key: "thumb", className: "dsh-lm-switch-thumb" })
          ])
        ]),

        // 行 2: 延迟时间
        h("div", { key: "row-delay", className: "dsh-lm-row" }, [
          h("div", { className: "dsh-lm-row-info" }, [
            h("div", { className: "dsh-lm-row-title" }, t("delayTitle")),
            h("div", { className: "dsh-lm-row-desc" }, t("delayDesc"))
          ]),
          h("div", { className: "dsh-lm-delay-ctrl" }, [
            h("div", { className: "dsh-lm-seg" }, presets.map(function (p) {
              var active = Number(cfg.delaySeconds) === p.sec;
              return h("button", {
                key: p.sec,
                type: "button",
                className: "dsh-lm-seg-btn",
                "data-active": active ? "true" : "false",
                onClick: function () { update({ delaySeconds: p.sec }); }
              }, p.label);
            })),
            h("div", { className: "dsh-lm-input-wrap" }, [
              h("input", {
                type: "number",
                min: 5,
                max: 3600,
                className: "dsh-lm-input",
                value: cfg.delaySeconds,
                onChange: function (e) {
                  var v = parseInt(e.target.value, 10);
                  update({ delaySeconds: isNaN(v) ? 30 : Math.max(5, Math.min(3600, v)) });
                }
              }),
              h("span", { className: "dsh-lm-input-unit" }, t("delayUnit"))
            ])
          ])
        ]),

        // 行 3: 回收策略
        h("div", { key: "row-mode", className: "dsh-lm-row" }, [
          h("div", { className: "dsh-lm-row-info" }, [
            h("div", { className: "dsh-lm-row-title" }, t("modeTitle")),
            h("div", { className: "dsh-lm-row-desc" }, t("modeDesc"))
          ]),
          h("select", {
            className: "dsh-lm-select",
            value: cfg.mode || "auto",
            onChange: function (e) { update({ mode: e.target.value }); }
          }, [
            h("option", { key: "auto", value: "auto" }, t("modeAuto")),
            h("option", { key: "workingset", value: "workingset" }, t("modeWorkingset")),
            h("option", { key: "suspend", value: "suspend" }, t("modeSuspend"))
          ])
        ])
      ]),

      // 提示说明卡片
      h("div", { key: "tips", className: "dsh-lm-tip-card" }, [
        h("div", { className: "dsh-lm-tip-header" }, [
          h("span", { key: "icon" }, "💡"),
          h("span", { key: "txt" }, t("tipTitle"))
        ]),
        h("ul", { className: "dsh-lm-tip-list" }, [
          h("li", { key: "t1", className: "dsh-lm-tip-item" }, [
            h("span", { className: "dsh-lm-tip-dot" }, "•"),
            h("span", null, t("tip1"))
          ]),
          h("li", { key: "t2", className: "dsh-lm-tip-item" }, [
            h("span", { className: "dsh-lm-tip-dot" }, "•"),
            h("span", null, t("tip2"))
          ]),
          h("li", { key: "t3", className: "dsh-lm-tip-item" }, [
            h("span", { className: "dsh-lm-tip-dot" }, "•"),
            h("span", null, t("tip3"))
          ])
        ])
      ]),

      // 底部操作栏
      h("div", { key: "footer", className: "dsh-lm-footer" }, [
        h("div", { className: "dsh-lm-footer-left" }, [
          h("button", {
            key: "btn-save",
            type: "button",
            className: "dsh-lm-btn-save",
            onClick: save
          }, saving ? t("saving") : t("save")),
          h("button", {
            key: "btn-reset",
            type: "button",
            className: "dsh-lm-btn-reset",
            onClick: resetDefaults
          }, t("reset")),
          msg.text ? h("span", {
            key: "msg",
            className: "dsh-lm-msg " + (msg.type === "err" ? "dsh-lm-msg-err" : "dsh-lm-msg-ok")
          }, (msg.type === "ok" ? "✓ " : "✕ ") + msg.text) : null
        ])
      ])
    ]);
  }

  function apply(ctx) {
    try {
      ctxRef = ctx;
      if (!ctx || !ctx.slots || typeof ctx.slots.inject !== "function") return;

      if (ctx.locale && typeof ctx.locale.register === "function") {
        try {
          ctx.locale.register(NS, "zh", zh);
          ctx.locale.register(NS, "en", en);
        } catch (e) {}
      }

      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "lightweight-mode",
          order: 90,
          label: function () {
            return t("title");
          },
          locale: NS,
        }, Section);
      });
    } catch (e) {
      try { console.warn("[dsh-lightweight-mode] client apply failed", e); } catch (e2) {}
    }
  }

  exports.apply = apply;
  exports.inject = inject;
  return module.exports;
}});
