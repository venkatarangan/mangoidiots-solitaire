import { test, expect } from "./browser-fixtures.js";
import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import { loaded, start, readSave, stockClick, fixture, layout, root, storageKey } from "./helpers.js";

async function chooseTheme(page, id) {
  const previousCanvas = await page.locator("#board canvas").elementHandle();
  await page.locator("#themes").click();
  await page.getByLabel("Available theme packs").selectOption(`${id}@1.1.0`);
  await page.getByRole("button", { name: "Use theme", exact: true }).click();
  await expect.poll(() => previousCanvas.evaluate((canvas) => canvas.isConnected), { timeout: 40000 }).toBe(false);
  await expect(page.locator("#loading")).toBeHidden({ timeout: 40000 });
  await expect(page.locator("#theme-label")).toHaveText(id === "chola" ? "Chola Royal Court" : "Mughal Gardens");
}

async function assertScreenFit(page) {
  const dimensions = await page.evaluate(() => {
    const canvas = document.querySelector("#board canvas");
    const box = canvas.getBoundingClientRect();
    const layout = JSON.parse(canvas.dataset.layout);
    const viewport = { width: innerWidth, height: visualViewport.height };
    const controls = ["undo", "hint", "pause", "themes", "menu"].map((id) => {
      const { x, y, width, height } = document.getElementById(id).getBoundingClientRect();
      return { id, x, y, width, height };
    });
    const piles = Object.values(layout.piles).map((r) => ({ ...r, x: r.x + box.x, y: r.y + box.y }));
    const tails = layout.columns.map((c) => box.y + (c.cardY.at(-1) ?? layout.piles.t0.y) + layout.cardHeight);
    return { viewport, controls, piles, tails, boxBottom: box.bottom, side: layout.side,
      scrollY, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  expect(dimensions.side).toBe(true);
  expect(dimensions.scrollY).toBe(0);
  expect(dimensions.overflow).toBe(false);
  expect(dimensions.boxBottom).toBeLessThanOrEqual(dimensions.viewport.height + 1);
  for (const r of [...dimensions.controls, ...dimensions.piles]) {
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(dimensions.viewport.width + 1);
    expect(r.y + r.height).toBeLessThanOrEqual(dimensions.viewport.height + 1);
  }
  for (const r of dimensions.controls) {
    expect(r.width, r.id).toBeGreaterThanOrEqual(44);
    expect(r.height, r.id).toBeGreaterThanOrEqual(44);
  }
  for (const tail of dimensions.tails) expect(tail).toBeLessThanOrEqual(dimensions.viewport.height);
}

const views = [
  { width: 320, height: 680, dpr: 2 },
  { width: 375, height: 700, dpr: 2 },
  { width: 390, height: 700, dpr: 3 },
  { width: 430, height: 780, dpr: 3 },
  { width: 667, height: 300, dpr: 3 },
  { width: 780, height: 320, dpr: 2 },
  { width: 844, height: 390, dpr: 3 },
  { width: 1366, height: 768, dpr: 1 },
  { width: 1920, height: 1080, dpr: 2 },
];
for (const view of views) {
  test.describe(`${view.width}x${view.height} DPR${view.dpr}`, () => {
    test.use({ viewport: view, deviceScaleFactor: view.dpr, reducedMotion: "reduce" });
    for (const theme of ["chola", "mughal"]) {
      test(`${view.height <= 390 ? "landscape screen fit" : "readable cards"} ${theme}`, async ({ page }, testInfo) => {
        await loaded(page);
        if (theme === "mughal") await chooseTheme(page, theme);
        const pause = await page.locator("#resume").boundingBox();
        const surface = await page.locator("#board-wrap").boundingBox();
        expect(pause.y + pause.height).toBeLessThanOrEqual(surface.y + surface.height);
        await page.locator("#resume").click();
        const l = await layout(page);
        expect(Math.abs(l.box.height - l.geometry.height)).toBeLessThan(1);
        expect(Math.abs(l.box.width - l.geometry.width)).toBeLessThan(1);
        const density = await page.locator("#board canvas").evaluate((c) => c.width / c.getBoundingClientRect().width);
        expect(density).toBeGreaterThanOrEqual(Math.min(view.dpr, 2) - .01);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (l.geometry.compact) expect(l.width * 86 / 240).toBeGreaterThanOrEqual(view.height <= 390 ? 12 : 14);
        if (view.height <= 390) {
          await page.locator("#zoom-fit").click();
          await expect(page.locator("#zoom-level")).toHaveText("Fit");
          await assertScreenFit(page);
        }
        await page.screenshot({ path: testInfo.outputPath(`${theme}-initial.png`), fullPage: true });
        await fixture(page, `
          const run=Array.from({length:13},(_,i)=>(i%2 ? 13 : 0)+12-i);
          const rest=Array.from({length:52},(_,i)=>i).filter(i=>!run.includes(i));
          const hidden=rest.splice(0,20);
          current.board={stock:rest,waste:[],foundations:[[],[],[],[]],
            tableau:[{cards:[...hidden,...run],faceUp:20},...Array.from({length:6},()=>({cards:[],faceUp:0}))]};
          current.undo=[]; current.started=false; return current;
        `);
        await page.locator("#resume").click();
        await page.locator("#zoom-fit").click();
        await expect(page.locator("#zoom-level")).toHaveText("Fit");
        if (view.height <= 390) await assertScreenFit(page);
        await page.screenshot({ path: testInfo.outputPath(`${theme}-long-stack.png`), fullPage: true });
        const long = await layout(page);
        for (const [index, y] of long.geometry.columns[0].cardY.entries()) {
          if (index > 20) expect(y - long.geometry.columns[0].cardY[index - 1]).toBeGreaterThanOrEqual(long.width * .36 - .001);
        }
      });
    }
  });
}

test.describe("Retina rotation", () => {
  test.use({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 3, reducedMotion: "reduce" });
  test("Retina landscape drag, rotation and keyboard controls preserve the game", async ({ page }) => {
    await loaded(page);
    await fixture(page, `
      current.board={stock:Array.from({length:51},(_,i)=>i+1),waste:[0],foundations:[[],[],[],[]],
        tableau:Array.from({length:7},()=>({cards:[],faceUp:0}))};
      current.undo=[];current.started=false;return current;
    `);
    await page.locator("#resume").click();
    await page.locator("#zoom-fit").click();
    await expect(page.locator("#zoom-level")).toHaveText("Fit");
    const before = await readSave(page);
    const portrait = await layout(page);
    await page.mouse.move(portrait.piles.waste.x + portrait.width / 2, portrait.piles.waste.y + portrait.height / 2);
    await page.mouse.down();
    await page.mouse.move(portrait.piles.f0.x + portrait.width / 2, portrait.piles.f0.y + portrait.height / 2, { steps: 12 });
    await expect(page.locator("#message")).toHaveText("Release to place on the spades foundation.");
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(async () => (await layout(page)).geometry.side).toBe(true);
    await page.mouse.up();
    expect((await readSave(page)).board).toEqual(before.board);
    const l = await layout(page), source = l.piles.waste, target = l.piles.f0;
    await page.mouse.move(source.x + l.width * .85, source.y + l.height * .8);
    await page.mouse.down();
    await page.mouse.move(target.x + l.width * 1.4, target.y + l.height * .8, { steps: 12 });
    await expect(page.locator("#message")).toHaveText("Release to place on the spades foundation.");
    await page.mouse.up();
    expect((await readSave(page)).board.foundations[0]).toEqual([0]);
    await page.locator("#undo").click();
    expect((await readSave(page)).board).toEqual(before.board);
    await page.setViewportSize({ width: 844, height: 300 });
    await expect.poll(async () => (await layout(page)).box.height).toBeLessThan(260);
    await assertScreenFit(page);
    await page.locator("#menu").click();
    await page.getByRole("button", { name: "Card list & keyboard play", exact: true }).click();
    await expect(page.locator("#keyboard-dialog")).toBeVisible();
    await page.locator("#card-list").getByRole("button", { name: "Ace of spades", exact: true }).click();
    await page.locator("#card-list").getByRole("button", { name: "Place on spades", exact: true }).click();
    await expect(page.locator("#keyboard-message")).toHaveText("Move Ace of spades to spades foundation.");
    await page.locator("#keyboard-close").click();
    await expect(page.locator("#menu")).toBeFocused();
    expect((await readSave(page)).board.foundations[0]).toEqual([0]);
    await page.setViewportSize({ width: 390, height: 700 });
    await expect.poll(async () => (await layout(page)).geometry.side).toBe(false);
    await page.locator("#undo").click();
    expect((await readSave(page)).board).toEqual(before.board);
  });
});

test("landscape screen fit respects reserved notch and home-indicator space", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await start(page);
  await page.locator("#zoom-fit").click();
  await expect(page.locator("#zoom-level")).toHaveText("Fit");
  // Desktop emulation has zero env(safe-area-inset-*); reserve equivalent space explicitly.
  await page.addStyleTag({ content: ".compact-play .app-shell { padding: 0 44px 21px; }" });
  expect(await page.locator(".app-shell").evaluate((shell) => ({
    padding: getComputedStyle(shell).padding,
    height: shell.getBoundingClientRect().height,
  }))).toEqual({ padding: "0px 44px 21px", height: 390 });
  await expect.poll(async () => (await layout(page)).box.height).toBeLessThan(320);
  await assertScreenFit(page);
  const board = await page.locator("#board canvas").boundingBox();
  const controls = await page.locator(".toolbar").boundingBox();
  expect(board.x).toBeGreaterThanOrEqual(44);
  expect(board.y + board.height).toBeLessThanOrEqual(390 - 21);
  expect(controls.x + controls.width).toBeLessThanOrEqual(844 - 44);
});

async function seedLegacyCache(page) {
  const entries = unzipSync(await readFile("generated/chola-pack.zip"));
  const manifest = JSON.parse(new TextDecoder().decode(entries["manifest.json"]));
  const compact = new Set(Object.values(manifest.compactCards));
  delete manifest.compactCards;
  manifest.version = "1.0.0";
  manifest.files = manifest.files.filter((file) => !compact.has(file.path));
  const assets = manifest.files.map((file) => ({ ...file, data: Buffer.from(entries[file.path]).toString("base64") }));
  await page.goto("/__test__/blank");
  await page.evaluate(async ({ manifest, assets, root, storageKey }) => {
    const base = new URL(root, location.href);
    const cache = await caches.open(`mangoidiots-theme:${root}:chola:1.0.0`);
    for (const file of assets) {
      const bytes = Uint8Array.from(atob(file.data), (char) => char.charCodeAt(0));
      await cache.put(new URL(`_theme/chola/1.0.0/${file.path}`, base),
        new Response(bytes, { headers: { "Content-Type": file.mime } }));
    }
    await cache.put(new URL("_theme/chola/1.0.0/manifest.json", base), new Response(JSON.stringify(manifest)));
    await caches.delete(`mangoidiots-theme:${root}:chola:1.1.0`);
    await new Promise((resolve, reject) => {
      const request = indexedDB.open(storageKey, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction("state", "readwrite"), store = tx.objectStore("state");
        const read = store.get("preferences");
        read.onsuccess = () => store.put({ ...read.result, themeVersion: "1.0.0" }, "preferences");
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => reject(tx.error);
      };
    });
  }, { manifest, assets, root, storageKey });
}

test("cached theme upgrade preserves saves and retains usable art after an interrupted update", async ({ page, context }) => {
  await start(page); await stockClick(page); await page.locator("#pause").click();
  const before = await readSave(page);
  await seedLegacyCache(page);
  await page.evaluate(() => sessionStorage.setItem("test-block-theme-update", "true"));
  // WebKit service-worker-controlled requests bypass Playwright's network routing.
  await page.addInitScript(() => {
    const fetch = window.fetch;
    window.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      if (url.pathname.endsWith("/themes/chola-1.1.0.zip") && sessionStorage.getItem("test-block-theme-update")) {
        return Promise.resolve(new Response("Unavailable", { status: 503 }));
      }
      return fetch(input, init);
    };
  });
  await loaded(page);
  await expect(page.locator("#message")).toContainText("Your installed theme is still available");
  expect((await readSave(page)).board).toEqual(before.board);
  expect((await readSave(page)).undo).toEqual(before.undo);
  await page.evaluate(() => sessionStorage.removeItem("test-block-theme-update"));
  await chooseTheme(page, "chola");
  expect((await readSave(page)).board).toEqual(before.board);
  await context.setOffline(true);
  await loaded(page);
  expect((await readSave(page)).board).toEqual(before.board);
  expect((await readSave(page)).elapsedMs).toEqual(before.elapsedMs);
  expect(await page.evaluate(async () => {
    const cache = await caches.open(`mangoidiots-theme:${new URL(document.baseURI).pathname}:chola:1.1.0`);
    const response = await cache.match(new URL("_theme/chola/1.1.0/manifest.json", document.baseURI));
    return Object.keys((await response.json()).compactCards).length;
  })).toBe(52);
});

test("cached theme upgrade retains playable cards when browser storage is full", async ({ page }) => {
  await start(page); await stockClick(page); await page.locator("#pause").click();
  const before = await readSave(page);
  await seedLegacyCache(page);
  await page.addInitScript(() => {
    const put = Cache.prototype.put;
    Cache.prototype.put = function (request, response) {
      const url = typeof request === "string" ? request : request.url ?? String(request);
      if (url.includes("_theme/chola/1.1.0/")) {
        return Promise.reject(new DOMException("Storage full", "QuotaExceededError"));
      }
      return put.call(this, request, response);
    };
  });
  await loaded(page);
  await expect(page.locator("#message")).toContainText("not enough browser storage");
  expect((await readSave(page)).board).toEqual(before.board);
  expect((await readSave(page)).undo).toEqual(before.undo);
});

test("cached theme upgrade automatically activates the same theme after validation", async ({ page }) => {
  await start(page); await stockClick(page); await page.locator("#pause").click();
  const before = await readSave(page);
  await seedLegacyCache(page);
  await loaded(page);
  expect(await readSave(page)).toEqual(before);
  const preferences = await page.evaluate(async (key) => new Promise((resolve, reject) => {
    const request = indexedDB.open(key, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction("state").objectStore("state").get("preferences");
      read.onsuccess = () => { db.close(); resolve(read.result); };
      read.onerror = () => reject(read.error);
    };
  }), storageKey);
  expect(preferences.theme).toBe("chola");
  expect(preferences.themeVersion).toBe("1.1.0");
});
