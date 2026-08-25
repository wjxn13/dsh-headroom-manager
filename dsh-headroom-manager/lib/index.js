// src/routes.ts
import { spawn, exec } from "node:child_process";
import { request as httpRequest } from "node:http";
var HEADROOM_EXE = "D:\\python\\Scripts\\headroom.exe";
var HEADROOM_PORT = 8787;
var LIVEZ_URL = `http://127.0.0.1:${HEADROOM_PORT}/livez`;
function sameOrigin(request) {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (origin === void 0 || host === void 0) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
function sendJson(response, status, body) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}
function fetchJson(url, timeoutMs = 3e3) {
  return new Promise((resolve) => {
    const req = httpRequest(url, { method: "GET", timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch {
          resolve(void 0);
        }
      });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve(void 0);
    });
    req.on("error", () => resolve(void 0));
    req.end();
  });
}
function findPortPid() {
  return new Promise((resolve) => {
    exec(`netstat -ano`, { encoding: "utf8" }, (err, stdout) => {
      if (err) return resolve(void 0);
      for (const line of stdout.split("\n")) {
        if (line.includes(`:${HEADROOM_PORT}`) && line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (/^\d+$/.test(pid)) return resolve(pid);
        }
      }
      resolve(void 0);
    });
  });
}
function killPid(pid) {
  return new Promise((resolve) => {
    exec(`taskkill /F /PID ${pid}`, (err) => resolve(!err));
  });
}
function mountManagerRoutes(ctx) {
  const webServer = ctx.get("webServer");
  if (webServer === void 0) {
    console.error("[dsh-headroom-manager] webServer absent \u2014 routes not mounted");
    return () => {
    };
  }
  async function status() {
    const livez = await fetchJson(LIVEZ_URL);
    const running = livez !== void 0;
    let pid;
    if (running) pid = await findPortPid();
    let savings;
    if (running) {
      savings = await fetchJson(`http://127.0.0.1:${HEADROOM_PORT}/stats-history`) ?? void 0;
      savings = savings?.lifetime;
    }
    return {
      running,
      version: livez?.version,
      pid,
      exe: HEADROOM_EXE,
      port: HEADROOM_PORT,
      savings: savings ?? null
    };
  }
  const disposers = [
    webServer.register({
      kind: "exact",
      path: "/headroom-mgr/status",
      handler: (_request, response) => {
        void status().then((s) => sendJson(response, 200, s));
      }
    }),
    webServer.register({
      kind: "exact",
      path: "/headroom-mgr/start",
      handler: async (request, response) => {
        if (request.method !== "POST") {
          sendJson(response, 405, { error: "method not allowed; use POST" });
          return;
        }
        if (!sameOrigin(request)) {
          sendJson(response, 403, { error: "untrusted origin" });
          return;
        }
        const already = await fetchJson(LIVEZ_URL);
        if (already !== void 0) {
          sendJson(response, 200, { ok: true, alreadyRunning: true });
          return;
        }
        try {
          const vbsPath = `${process.env.USERPROFILE}\\.headroom\\start-headroom.vbs`;
          const child = spawn("cmd.exe", ["/c", "start", '""', "wscript.exe", `"${vbsPath}"`], {
            detached: true,
            stdio: "ignore",
            windowsVerbatimArguments: true
          });
          child.unref();
          const deadline = Date.now() + 2e4;
          let live = void 0;
          while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 1500));
            live = await fetchJson(LIVEZ_URL);
            if (live !== void 0) break;
          }
          sendJson(response, 200, {
            ok: true,
            healthyAfterStart: live !== void 0
          });
        } catch (err) {
          sendJson(response, 500, { error: String(err) });
        }
      }
    }),
    webServer.register({
      kind: "exact",
      path: "/headroom-mgr/stop",
      handler: async (request, response) => {
        if (request.method !== "POST") {
          sendJson(response, 405, { error: "method not allowed; use POST" });
          return;
        }
        if (!sameOrigin(request)) {
          sendJson(response, 403, { error: "untrusted origin" });
          return;
        }
        const pid = await findPortPid();
        if (pid === void 0) {
          sendJson(response, 200, { ok: true, wasRunning: false });
          return;
        }
        const killed = await killPid(pid);
        sendJson(response, killed ? 200 : 500, {
          ok: killed,
          stoppedPid: killed ? pid : void 0
        });
      }
    })
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}

// src/index.ts
var name = "dsh-headroom-manager";
var inject = [];
function apply(ctx) {
  ctx.inject(["webServer"], (scoped) => {
    scoped.effect(() => mountManagerRoutes(scoped), "dsh-headroom-manager http routes");
  });
}
export {
  apply,
  inject,
  name
};
//# sourceMappingURL=index.js.map
