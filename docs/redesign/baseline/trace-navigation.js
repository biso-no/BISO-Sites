// Chrome trace of one mobile navigation, filtered to the timeline events that
// explain when a paint happened and what the main thread was doing.
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const PORT = 9350,
  PROFILE = "/tmp/claude-cdp-trace";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class CDP {
  constructor(u) {
    this.ws = new WebSocket(u);
    this.id = 0;
    this.p = new Map();
    this.ev = [];
    this.ready = new Promise((r) => (this.ws.onopen = r));
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.p.has(m.id)) {
        this.p.get(m.id)(m);
        this.p.delete(m.id);
      } else if (m.method) {
        for (const h of this.ev) {
          h(m);
        }
      }
    };
  }
  on(fn) {
    this.ev.push(fn);
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.p.set(id, res);
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => rej(new Error(`timeout ${method}`)), 120_000);
    });
  }
  close() {
    this.ws.close();
  }
}
(async () => {
  const base = process.argv[2],
    route = process.argv[3],
    out = process.argv[4];
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${PROFILE}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--mute-audio",
    ],
    { stdio: "ignore" }
  );
  let v;
  for (let i = 0; i < 40; i++) {
    try {
      v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      break;
    } catch {
      await sleep(250);
    }
  }
  const b = new CDP(v.webSocketDebuggerUrl);
  await b.ready;
  const {
    result: { targetId },
  } = await b.send("Target.createTarget", { url: "about:blank" });
  const page = new CDP(`ws://127.0.0.1:${PORT}/devtools/page/${targetId}`);
  await page.ready;
  await page.send("Page.enable");
  await page.send("Network.enable");
  await page.send("Runtime.enable");
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
  });
  await page.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    latency: 150,
  });
  await page.send("Network.setCacheDisabled", { cacheDisabled: true });

  const events = [];
  page.on((m) => {
    if (m.method === "Tracing.dataCollected") {
      events.push(...m.params.value);
    }
  });
  const done = new Promise((res) =>
    page.on((m) => {
      if (m.method === "Tracing.tracingComplete") {
        res();
      }
    })
  );
  await page.send("Tracing.start", {
    traceConfig: {
      includedCategories: [
        "devtools.timeline",
        "disabled-by-default-devtools.timeline",
        "disabled-by-default-devtools.timeline.frame",
        "blink.user_timing",
        "loading",
        "latencyInfo",
      ],
    },
    transferMode: "ReportEvents",
  });
  await page.send("Page.navigate", { url: base + route });
  await sleep(9000);
  await page.send("Tracing.end");
  await done;
  fs.writeFileSync(out, JSON.stringify(events));
  console.log("events:", events.length, "->", out);
  b.close();
  chrome.kill();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
