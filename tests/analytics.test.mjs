import test from "node:test";
import assert from "node:assert/strict";

const TAG = "https://www.googletagmanager.com/gtag/js?id=G-5PDTHH6KFT";
let instance = 0;

function define(name, value) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

// Each call imports a fresh module so its one-shot start guard is reset.
async function analytics({ hostname = "solitaire.mangoidiots.com", onLine = true, doNotTrack = null,
  globalPrivacyControl = false, idle = true, appendError } = {}) {
  const appended = [], scheduled = [];
  define("window", globalThis);
  define("location", { hostname });
  define("navigator", { onLine, doNotTrack, globalPrivacyControl });
  define("document", {
    createElement: (tag) => ({ tag }),
    head: { append(node) { if (appendError) throw appendError; appended.push(node); } },
  });
  delete globalThis.dataLayer; delete globalThis.gtag;
  if (idle) define("requestIdleCallback", (callback, options) => scheduled.push({ callback, options }));
  else delete globalThis.requestIdleCallback;
  const { startAnalytics } = await import(`../src/analytics.ts?instance=${instance++}`);
  return { startAnalytics, appended, scheduled };
}

for (const hostname of ["127.0.0.1", "localhost", "venkatarangan.github.io", "preview.mangoidiots.com"]) {
  test(`analytics never starts on ${hostname}`, async () => {
    const { startAnalytics, appended, scheduled } = await analytics({ hostname });
    startAnalytics();
    assert.equal(scheduled.length, 0);
    assert.equal(appended.length, 0);
    assert.equal(globalThis.dataLayer, undefined);
  });
}

test("Global Privacy Control and Do Not Track disable analytics", async () => {
  for (const privacy of [{ globalPrivacyControl: true }, { doNotTrack: "1" }]) {
    const { startAnalytics, appended, scheduled } = await analytics(privacy);
    startAnalytics();
    assert.equal(scheduled.length, 0);
    assert.equal(appended.length, 0);
  }
});

test("analytics waits for idle time and loads one async tag with advertising off", async () => {
  const { startAnalytics, appended, scheduled } = await analytics();
  startAnalytics(); startAnalytics();
  assert.equal(scheduled.length, 1);
  assert.equal(appended.length, 0);
  scheduled[0].callback();
  assert.equal(appended.length, 1);
  assert.equal(appended[0].tag, "script");
  assert.equal(appended[0].src, TAG);
  assert.equal(appended[0].async, true);
  const calls = globalThis.dataLayer.map((entry) => Array.from(entry));
  assert.deepEqual(calls.map(([command]) => command), ["consent", "js", "config"]);
  assert.deepEqual(calls[0][2], {
    ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted",
  });
  assert.deepEqual(calls[2], ["config", "G-5PDTHH6KFT", {
    allow_google_signals: false, allow_ad_personalization_signals: false,
  }]);
});

test("a connection lost before idle time skips the tag", async () => {
  const { startAnalytics, appended, scheduled } = await analytics();
  startAnalytics();
  navigator.onLine = false;
  scheduled[0].callback();
  assert.equal(appended.length, 0);
  assert.equal(globalThis.dataLayer, undefined);
});

test("offline starts never schedule a Google request", async () => {
  const { startAnalytics, appended, scheduled } = await analytics({ onLine: false });
  startAnalytics();
  scheduled[0]?.callback();
  assert.equal(appended.length, 0);
});

test("analytics failures never escape into the game", async () => {
  const { startAnalytics, scheduled } = await analytics({ appendError: new Error("blocked") });
  assert.doesNotThrow(() => startAnalytics());
  assert.doesNotThrow(() => scheduled[0].callback());
  Object.defineProperty(globalThis, "location", { get() { throw new Error("unavailable"); }, configurable: true });
  const fresh = await import(`../src/analytics.ts?instance=${instance++}`);
  assert.doesNotThrow(() => fresh.startAnalytics());
});

test("browsers without requestIdleCallback load after a delay", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { startAnalytics, appended } = await analytics({ idle: false });
  startAnalytics();
  assert.equal(appended.length, 0);
  t.mock.timers.tick(3000);
  assert.equal(appended.length, 1);
});
