// Paired mobile LCP sampler: alternates new(:3000) / old(:3001) so machine drift
// hits both arms equally. n samples per route per build.
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const { spawn } = require("node:child_process");
const PORT = 9341,
  PROFILE = "/tmp/claude-cdp-paired";
const PROBE = `new Promise((resolve) => {
  let best = null;
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) best = e; })
    .observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {}
  const done = () => { const f = performance.getEntriesByName('first-contentful-paint')[0];
    resolve(JSON.stringify({ lcp: best?Math.round(best.startTime):0, fcp: f?Math.round(f.startTime):0 })); };
  if (document.readyState === 'complete') setTimeout(done, 2500); else addEventListener('load', () => setTimeout(done, 2500));
})`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class CDP {
  constructor(u) {
    this.ws = new WebSocket(u);
    this.id = 0;
    this.p = new Map();
    this.ready = new Promise((r) => (this.ws.onopen = r));
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.p.has(m.id)) {
        this.p.get(m.id)(m);
        this.p.delete(m.id);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.p.set(id, res);
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => rej(new Error(`timeout ${method}`)), 90_000);
    });
  }
  close() {
    this.ws.close();
  }
}
(async () => {
  const routes = process.argv[2].split(","),
    n = Number(process.argv[3] || 7);
  require("node:fs").rmSync(PROFILE, { recursive: true, force: true });
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
  const acc = {};
  const load = async (base, route) => {
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
    await page.send("Page.navigate", { url: base + route });
    let m = { lcp: -1 };
    try {
      const r = await page.send("Runtime.evaluate", {
        expression: PROBE,
        awaitPromise: true,
        returnByValue: true,
        timeout: 90_000,
      });
      m = JSON.parse(r.result.result.value);
    } catch {
      // A probe that never resolves leaves lcp at -1 rather than aborting the
      // run; a dropped sample is visible in the printed list.
    }
    page.close();
    await b.send("Target.closeTarget", { targetId });
    return m;
  };
  for (const route of routes) {
    for (const arm of ["new", "old"]) {
      acc[`${arm}${route}`] = [];
    }
    for (let i = 0; i < n; i++) {
      for (const [arm, base] of [
        ["new", "http://localhost:3000"],
        ["old", "http://localhost:3001"],
      ]) {
        const m = await load(base, route);
        acc[`${arm}${route}`].push(m.lcp);
      }
    }
    const fmt = (a) => {
      const s = [...a].sort((x, y) => x - y);
      return `median ${s[Math.floor((s.length - 1) / 2)]}  [${s.join(", ")}]`;
    };
    process.stderr.write(
      `${route}\n  new  ${fmt(acc[`new${route}`])}\n  old  ${fmt(acc[`old${route}`])}\n`
    );
  }
  console.log(JSON.stringify(acc, null, 1));
  b.close();
  chrome.kill();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
