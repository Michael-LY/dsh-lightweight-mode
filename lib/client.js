window.__ModuleLoader__.load({ id: "dsh-lightweight-mode", factory: (require) => {
  var module = { exports: {} };
  var exports = module.exports;
  var React = require("react");
  var h = React.createElement;
  var NS = "dsh-lightweight-mode";
  var inject = ["slots", "locale"];
  function lbl(key, fallback) {
    try { return ctxRef && ctxRef.locale && ctxRef.locale.bind ? ctxRef.locale.bind(NS)(key) : fallback; } catch (e) { return fallback; }
  }
  var ctxRef = null;
  function Section() {
    var state = React.useState(null);
    var cfg = state[0]; var setCfg = state[1];
    var msgState = React.useState("");
    var msg = msgState[0]; var setMsg = msgState[1];
    React.useEffect(function () {
      fetch("/dsh-lightweight-mode/config").then(function (r) { return r.json(); }).then(function (v) { setCfg(v); }).catch(function (e) { setMsg(String(e && e.message || e)); });
    }, []);
    if (!cfg) return h("div", { style: { padding: 16, color: "#888" } }, "加载中… / Loading…");
    function update(patch) { setCfg(Object.assign({}, cfg, patch)); }
    function save() {
      fetch("/dsh-lightweight-mode/config", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cfg) })
        .then(function (r) { return r.json(); })
        .then(function (v) { setCfg(v); setMsg("已保存 / Saved"); })
        .catch(function (e) { setMsg(String(e && e.message || e)); });
    }
    var rowStyle = { display: "flex", gap: 10, alignItems: "center" };
    return h("div", { style: { padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 } }, [
      h("div", { key: "title", style: { fontWeight: 600, fontSize: 16 } }, "轻量模式 / Lightweight Mode"),
      h("div", { key: "desc", style: { color: "#888", fontSize: 13 } }, "关闭窗口到托盘后，等待指定秒数后释放界面绘制内存；托盘图标菜单也可修改。 / Release UI memory after the window is hidden to tray."),
      h("label", { key: "enabled", style: rowStyle }, [
        h("input", { key: "i", type: "checkbox", checked: !!cfg.enabled, onChange: function (e) { update({ enabled: e.target.checked }); } }),
        h("span", { key: "s" }, "启用 / Enabled"),
      ]),
      h("label", { key: "delay", style: rowStyle }, [
        h("span", { key: "s" }, "延迟（秒）/ Delay (s)"),
        h("input", { key: "i", type: "number", min: 5, max: 3600, value: cfg.delaySeconds, onChange: function (e) { update({ delaySeconds: Number(e.target.value) || 30 }); }, style: { width: 110, padding: "4px 8px" } }),
      ]),
      h("label", { key: "mode", style: rowStyle }, [
        h("span", { key: "s" }, "模式 / Mode"),
        h("select", { key: "i", value: cfg.mode || "auto", onChange: function (e) { update({ mode: e.target.value }); }, style: { padding: "4px 8px" } }, [
          h("option", { key: "a", value: "auto" }, "自动 / Auto"),
          h("option", { key: "w", value: "workingset" }, "工作集裁剪 / Working set"),
          h("option", { key: "x", value: "suspend" }, "冻结进程 / Suspend"),
        ]),
      ]),
      h("div", { key: "actions", style: { display: "flex", gap: 12, alignItems: "center" } }, [
        h("button", { key: "s", onClick: save, style: { padding: "6px 16px", cursor: "pointer" } }, "保存 / Save"),
        h("span", { key: "m", style: { color: "#888", fontSize: 13 } }, msg),
      ]),
    ]);
  }
  function apply(ctx) {
    try {
      ctxRef = ctx;
      if (!ctx || !ctx.slots || typeof ctx.slots.inject !== "function") return;
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "lightweight-mode",
          order: 90,
          label: function () { return lbl("nav", "轻量模式 / Lightweight"); },
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