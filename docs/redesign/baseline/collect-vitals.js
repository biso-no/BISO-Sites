// Core Web Vitals via raw CDP. No dependencies.
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const { spawn } = require("node:child_process");
const fs = require("node:fs");

const PORT = 9333;
const PROFILE = "/tmp/claude-cdp-profile";

const PROBE = `new Promise((resolve) => {
  const out = { lcp: 0, cls: 0, fcp: 0, ttfb: 0, dcl: 0, load: 0, longTasks: 0, tbt: 0,
                reqs: 0, transferKB: 0, jsKB: 0, cssKB: 0, imgKB: 0, fontKB: 0, domNodes: 0 };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) out.lcp = e.startTime; })
    .observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) out.cls += e.value; })
    .observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) { out.longTasks++; out.tbt += Math.max(0, e.duration - 50); } })
    .observe({ type: 'longtask', buffered: true }); } catch (e) {}
  const done = () => {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) { out.ttfb = nav.responseStart; out.dcl = nav.domContentLoadedEventEnd; out.load = nav.loadEventEnd; }
    const f = performance.getEntriesByName('first-contentful-paint')[0]; if (f) out.fcp = f.startTime;
    for (const r of performance.getEntriesByType('resource')) {
      out.reqs++; const kb = (r.transferSize || 0) / 1024; out.transferKB += kb;
      const n = r.name;
      if (/\\.js(\\?|$)/.test(n) || r.initiatorType === 'script') out.jsKB += kb;
      else if (/\\.css(\\?|$)/.test(n) || r.initiatorType === 'link') out.cssKB += kb;
      else if (r.initiatorType === 'img' || /_next\\/image/.test(n)) out.imgKB += kb;
      else if (/\\.(woff2?|otf|ttf)(\\?|$)/.test(n)) out.fontKB += kb;
    }
    out.domNodes = document.getElementsByTagName('*').length;
    for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 100) / 100;
    resolve(JSON.stringify(out));
  };
  if (document.readyState === 'complete') setTimeout(done, 2500);
  else addEventListener('load', () => setTimeout(done, 2500));
})`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.ready = new Promise((res) => (this.ws.onopen = res));
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        this.pending.get(m.id)(m);
        this.pending.delete(m.id);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res) => {
      this.pending.set(id, res);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    this.ws.close();
  }
}

async function main() {
  const routes = process.argv[2].split(",");
  const profiles = [
    {
      name: "desktop",
      width: 1440,
      height: 900,
      dsf: 1,
      mobile: false,
      cpu: 1,
      down: -1,
      up: -1,
      lat: 0,
    },
    {
      name: "mobile",
      width: 390,
      height: 844,
      dsf: 3,
      mobile: true,
      cpu: 4,
      down: (1.6 * 1024 * 1024) / 8,
      up: (750 * 1024) / 8,
      lat: 150,
    },
  ];
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
      "--disable-sync",
      "--mute-audio",
    ],
    { stdio: "ignore" }
  );

  let version;
  for (let i = 0; i < 40; i++) {
    try {
      version = await (
        await fetch(`http://127.0.0.1:${PORT}/json/version`)
      ).json();
      break;
    } catch {
      await sleep(250);
    }
  }
  if (!version) {
    chrome.kill();
    throw new Error("Chrome did not expose CDP");
  }

  const browser = new CDP(version.webSocketDebuggerUrl);
  await browser.ready;
  const results = [];

  for (const p of profiles) {
    for (const route of routes) {
      const {
        result: { targetId },
      } = await browser.send("Target.createTarget", { url: "about:blank" });
      const tws = `ws://127.0.0.1:${PORT}/devtools/page/${targetId}`;
      const page = new CDP(tws);
      await page.ready;
      await page.send("Page.enable");
      await page.send("Network.enable");
      await page.send("Runtime.enable");
      await page.send("Emulation.setDeviceMetricsOverride", {
        width: p.width,
        height: p.height,
        deviceScaleFactor: p.dsf,
        mobile: p.mobile,
      });
      if (p.cpu > 1) {
        await page.send("Emulation.setCPUThrottlingRate", { rate: p.cpu });
      }
      if (p.down > 0) {
        await page.send("Network.emulateNetworkConditions", {
          offline: false,
          downloadThroughput: p.down,
          uploadThroughput: p.up,
          latency: p.lat,
        });
      }
      await page.send("Network.setCacheDisabled", { cacheDisabled: true });

      await page.send("Page.navigate", {
        url: `http://localhost:3000${route}`,
      });
      const r = await page.send("Runtime.evaluate", {
        expression: PROBE,
        awaitPromise: true,
        returnByValue: true,
        timeout: 60_000,
      });
      let m = null;
      try {
        m = JSON.parse(r.result.result.value);
      } catch {
        m = { error: "probe failed" };
      }
      results.push({ profile: p.name, route, ...m });
      process.stderr.write(
        `  ${p.name.padEnd(8)} ${route.padEnd(10)} LCP ${String(m.lcp ?? "?").padStart(8)}ms  CLS ${m.cls ?? "?"}\n`
      );
      page.close();
      await browser.send("Target.closeTarget", { targetId });
    }
  }
  browser.close();
  chrome.kill();
  console.log(JSON.stringify(results, null, 2));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
