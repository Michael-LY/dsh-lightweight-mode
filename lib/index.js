import z from "@deepseek-ai/schemastery";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

export const name = "dsh-lightweight-mode";

export const Config = z.object({
  enabled: z.boolean().default(true),
  delaySeconds: z.number().default(30),
  mode: z.string().default("auto"),
});

function homeDir() {
  return process.env.DSH_HOME || join(homedir(), ".dsh");
}
function configPath() {
  return join(homeDir(), "lightweight-mode.json");
}
function readConfig() {
  try {
    if (existsSync(configPath())) {
      const v = JSON.parse(readFileSync(configPath(), "utf8"));
      if (v && typeof v === "object") return v;
    }
  } catch (e) {}
  return {};
}
function writeConfig(next) {
  const merged = Object.assign({ enabled: true, delaySeconds: 30, mode: "auto" }, readConfig(), next);
  if (typeof merged.delaySeconds === "number") merged.delaySeconds = Math.max(5, Math.min(3600, Math.round(merged.delaySeconds)));
  try {
    mkdirSync(dirname(configPath()), { recursive: true });
    writeFileSync(configPath(), JSON.stringify(merged, null, 2));
  } catch (e) {}
  return merged;
}

export function apply(ctx, config) {
  writeConfig({
    enabled: config && typeof config.enabled === "boolean" ? config.enabled : true,
    delaySeconds: config && typeof config.delaySeconds === "number" ? config.delaySeconds : 30,
    mode: config && typeof config.mode === "string" ? config.mode : "auto",
  });
  ctx.inject(["webServer"], (webCtx) => {
    webCtx.effect(() => webCtx.webServer.register({
      kind: "prefix",
      path: "/dsh-lightweight-mode",
      handler: async (req, res) => {
        try {
          const url = new URL(req.url || "/", "http://127.0.0.1");
          if (url.pathname.endsWith("/config")) {
            if (req.method === "GET") {
              res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
              res.end(JSON.stringify(readConfig()));
              return;
            }
            if (req.method === "POST") {
              const chunks = [];
              for await (const chunk of req) chunks.push(chunk);
              let body = {};
              try { body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) { body = {}; }
              const next = writeConfig(body);
              res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
              res.end(JSON.stringify(next));
              return;
            }
            res.writeHead(405); res.end(); return;
          }
          if (url.pathname.endsWith("/state")) {
            res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ platform: process.platform, configFile: configPath() }));
            return;
          }
          res.writeHead(404); res.end();
        } catch (error) {
          try { res.writeHead(500, { "content-type": "text/plain" }); res.end(String(error && error.message)); } catch (e) {}
        }
      }
    }), "dsh-lightweight-mode: config route");
  });
}
