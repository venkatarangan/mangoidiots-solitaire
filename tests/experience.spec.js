import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { loaded, start, readSave, stockClick, fixture, layout } from "./helpers.js";

async function foundationFixture(page, suit = 0, rank = 1) {
  await fixture(page, `
    const card = value.suit * 13 + value.rank - 1;
    const foundations = Array.from({length:4}, (_,s) => s === value.suit
      ? Array.from({length:value.rank-1},(_,r)=>s*13+r) : []);
    const used = [card,...foundations.flat()];
    current.board = {stock:Array.from({length:52},(_,i)=>i).filter(i=>!used.includes(i)),waste:[card],
      tableau:Array.from({length:7},()=>({cards:[],faceUp:0})),foundations};
    current.undo=[]; current.movePoints=0; current.undoPenalty=0; current.elapsedMs=0;
    current.moves=0; current.started=false; return current;
  `, { suit, rank });
  await page.locator("#resume").click();
}
async function mouseDrag(page, from, to, release = true) {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  if (release) await page.mouse.up();
}
async function useTheme(page, id) {
  await page.locator("#menu").click();
  await page.getByRole("button", { name: "Theme collection", exact: true }).click();
  await page.getByLabel("Available theme packs").selectOption(`${id}@1.0.0`);
  const name = await page.getByLabel("Available theme packs").locator("option:checked").textContent();
  await page.getByRole("button", { name: "Use theme", exact: true }).click();
  await expect(page.locator("#theme-label")).toHaveText(name, { timeout: 40000 });
  await expect(page.locator("#loading")).toBeHidden({ timeout: 40000 });
  await expect(page.locator("#error")).toBeHidden();
}

for (const viewport of [{ width: 320, height: 780 }, { width: 780, height: 420 }, { width: 1366, height: 950 }]) {
  for (let suit = 0; suit < 4; suit++) {
    for (const rank of [1, 7]) {
      test(`forgiving drag ${viewport.width}px suit ${suit} rank ${rank}: corners, centre and pointer outside`, async ({ page }) => {
        await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion: "reduce" });
        await loaded(page); await foundationFixture(page, suit, rank);
        const before = await readSave(page);
        const anchors = [[.05, .05], [.95, .05], [.5, .5], [.05, .95], [.95, .95]];
        for (let index = 0; index < anchors.length; index++) {
          // Undo is below the fold in landscape; return to the visible stock row.
          await page.evaluate(() => scrollTo(0, 0));
          const l = await layout(page);
          const [ax, ay] = anchors[index];
          const from = { x: l.x(1) + l.width * ax, y: l.top + l.height * ay };
          // Bottom and centre grabs leave the pointer outside the foundation.
          const to = { x: l.x(suit + 3) + l.width * ax, y: l.top + l.height * (.65 + ay) };
          await mouseDrag(page, from, to, false);
          await expect(page.locator("#message")).toHaveText(`Release to place on the ${["spades", "hearts", "clubs", "diamonds"][suit]} foundation.`);
          await page.mouse.up();
          await expect(page.locator("#moves")).toHaveText(String(index + 1));
          const moved = await readSave(page);
          expect(moved.board.foundations[suit]).toHaveLength(rank);
          expect(moved.board.waste).toEqual([]);
          expect(moved.movePoints).toBe(10);
          await expect(page.locator("#dialog")).not.toBeVisible();
          await page.locator("#undo").click();
          expect((await readSave(page)).board).toEqual(before.board);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      });
    }
  }
}

test("horizontal overlap accepts a pointer outside the foundation, but wrong-suit and distant drops do not move", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await loaded(page); await foundationFixture(page);
  const l = await layout(page), before = await readSave(page);
  const from = { x: l.x(1) + l.width * .95, y: l.top + l.height * .5 };
  for (const to of [
    { x: l.x(4) + l.width * .95, y: l.top + l.height * .5 },
    { x: l.x(1) + l.width * .95, y: l.box.y + l.box.height - 10 },
    { x: l.box.x - 5, y: l.top + l.height * .5 },
  ]) {
    await mouseDrag(page, from, to);
    expect((await readSave(page)).board).toEqual(before.board);
    await expect(page.locator("#moves")).toHaveText("0");
  }
  await mouseDrag(page, from, { x: l.x(3) + l.width * 1.6, y: l.top + l.height * .5 });
  await expect(page.locator("#moves")).toHaveText("1");
  expect((await readSave(page)).board.foundations[0]).toEqual([0]);
});

test("a full sequence moves by its leading card, reveals, and undoes without a phantom inspector click", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await loaded(page);
  await fixture(page, `
    const used=[0,19,5,17,7];
    current.board={stock:Array.from({length:52},(_,i)=>i).filter(i=>!used.includes(i)),waste:[],
      tableau:[{cards:[0,19,5,17],faceUp:1},{cards:[7],faceUp:0},...Array.from({length:5},()=>({cards:[],faceUp:0}))],
      foundations:[[],[],[],[]]};current.undo=[];return current;
  `);
  await page.locator("#resume").click();
  const before = await readSave(page), l = await layout(page);
  const from = { x: l.x(0) + l.width * .5, y: l.tableau + l.backStep + l.faceStep * .4 };
  await mouseDrag(page, from, { x: l.x(3) + l.width * .5, y: l.top + l.faceStep * .4 });
  expect((await readSave(page)).board).toEqual(before.board);
  await mouseDrag(page, from, { x: l.x(1) + l.width * .5, y: l.tableau + l.height * .55 });
  await expect(page.locator("#moves")).toHaveText("1");
  const after = await readSave(page);
  expect(after.board.tableau[0]).toEqual({ cards: [0], faceUp: 0 });
  expect(after.board.tableau[1].cards).toEqual([7, 19, 5, 17]);
  expect(after.movePoints).toBe(5);
  await expect(page.locator("#dialog")).not.toBeVisible();
  await page.locator("#undo").click();
  expect((await readSave(page)).board).toEqual(before.board);
});

test("equally split legal columns do not guess, while a nearer column accepts the card", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await loaded(page);
  await fixture(page, `
    const used=[19,7,33];
    current.board={stock:Array.from({length:52},(_,i)=>i).filter(i=>!used.includes(i)),waste:[19],
      tableau:[{cards:[7],faceUp:0},{cards:[33],faceUp:0},...Array.from({length:5},()=>({cards:[],faceUp:0}))],
      foundations:[[],[],[],[]]}; current.undo=[];return current;
  `);
  await page.locator("#resume").click();
  const before = await readSave(page), l = await layout(page);
  const from = { x: l.x(1) + l.width / 2, y: l.top + l.height / 2 };
  await mouseDrag(page, from, { x: (l.x(0) + l.x(1)) / 2 + l.width / 2, y: l.tableau + l.height / 2 });
  expect((await readSave(page)).board).toEqual(before.board);
  await mouseDrag(page, from, { x: l.x(1) + l.width * .3, y: l.tableau + l.height / 2 });
  await expect(page.locator("#moves")).toHaveText("1");
  expect((await readSave(page)).board.tableau[1].cards).toEqual([33, 19]);
});

test("resize, Escape and window blur cancel held drags without losing cards or disabling the next drag", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await loaded(page); await foundationFixture(page);
  const before = await readSave(page);
  for (const action of ["resize", "escape", "blur"]) {
    const l = await layout(page);
    await mouseDrag(page, { x: l.x(1) + l.width / 2, y: l.top + l.height / 2 },
      { x: l.x(3) + l.width / 2, y: l.top + l.height * 1.15 }, false);
    if (action === "resize") await page.setViewportSize({ width: 750, height: 850 });
    if (action === "escape") await page.keyboard.press("Escape");
    if (action === "blur") await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.waitForTimeout(350);
    await page.mouse.up();
    expect((await readSave(page)).board).toEqual(before.board);
  }
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const l = await layout(page);
  await mouseDrag(page, { x: l.x(1) + l.width / 2, y: l.top + l.height / 2 },
    { x: l.x(3) + l.width / 2, y: l.top + l.height * 1.15 });
  await expect(page.locator("#moves")).toHaveText("1");
});

test("touch drag works with an offset grip, while touch cancellation keeps the board unchanged", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce", baseURL: "http://127.0.0.1:4173" });
  try {
    const page = await context.newPage(); await loaded(page); await foundationFixture(page, 3);
    const before = await readSave(page), l = await layout(page);
    const client = await context.newCDPSession(page);
    const from = { x: l.x(1) + l.width * .9, y: l.top + l.height * .9 };
    const to = { x: l.x(6) + l.width * .9, y: l.top + l.height * 1.55 };
    for (const end of ["touchCancel", "touchEnd"]) {
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
      for (let step = 1; step <= 12; step++) {
        await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + (to.x - from.x) * step / 12, y: from.y + (to.y - from.y) * step / 12, id: 1 }] });
      }
      await expect(page.locator("#message")).toHaveText("Release to place on the diamonds foundation.");
      await client.send("Input.dispatchTouchEvent", { type: end, touchPoints: [] });
      if (end === "touchCancel") expect((await readSave(page)).board).toEqual(before.board);
      else {
        await expect(page.locator("#moves")).toHaveText("1");
        expect((await readSave(page)).board.foundations[3]).toEqual([39]);
      }
    }
    expect(await page.evaluate(() => scrollY)).toBe(0);
  } finally { await context.close(); }
});

test("a background timer save cannot reject a legal drop or overwrite its new board", async ({ page }) => {
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, "oncomplete");
    Object.defineProperty(IDBTransaction.prototype, "oncomplete", {
      ...descriptor,
      set(handler) {
        if (!window.delayNextSave || this.mode !== "readwrite") return descriptor.set.call(this, handler);
        window.delayNextSave = false;
        descriptor.set.call(this, (event) => {
          window.saveWaiting = true;
          setTimeout(() => { handler.call(this, event); window.saveWaiting = false; }, 4000);
        });
      },
    });
  });
  await page.emulateMedia({ reducedMotion: "reduce" }); await loaded(page); await foundationFixture(page);
  await page.locator("#hint").click();
  const l = await layout(page);
  await mouseDrag(page, { x: l.x(1) + l.width / 2, y: l.top + l.height / 2 },
    { x: l.x(3) + l.width / 2, y: l.top + l.height * 1.15 }, false);
  await page.evaluate(() => { window.delayNextSave = true; });
  await expect.poll(() => page.evaluate(() => window.saveWaiting), { timeout: 8000 }).toBe(true);
  await expect(page.locator("#message")).toHaveText("Release to place on the spades foundation.");
  await page.mouse.up();
  await expect(page.locator("#moves")).toHaveText("1");
  await expect.poll(() => page.evaluate(() => window.saveWaiting), { timeout: 6000 }).toBe(false);
  expect((await readSave(page)).board.foundations[0]).toEqual([0]);
});

test("Mangoidiots branding, exact attribution, supplied logo only in About/Help, and both theme choices", async ({ page }, testInfo) => {
  await start(page);
  await expect(page).toHaveTitle("Mangoidiots Solitaire");
  await expect(page.locator("footer")).toHaveText("Generated with OpenAI GPT-6 Astra. Play for free at venkatarangan.github.io/mangoidiots-solitaire.");
  await expect(page.locator("footer a")).toHaveAttribute("href", "https://venkatarangan.github.io/mangoidiots-solitaire/");
  expect(await page.locator(".app-shell img").count()).toBe(0);
  await page.locator("#menu").click();
  await page.getByRole("button", { name: "About Mangoidiots Solitaire", exact: true }).click();
  await expect(page.locator("#dialog-body")).toContainText("Generated with OpenAI GPT-6 Astra. Play for free at venkatarangan.github.io/mangoidiots-solitaire.");
  const image = page.getByAltText("MangoIdiots.com", { exact: true });
  await expect(image).toBeVisible();
  expect(await image.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  const logoBytes = await (await page.request.get(await image.getAttribute("src"))).body();
  expect(logoBytes).toEqual(await readFile("src/assets/mangoidiots-logo.png"));
  await page.screenshot({ path: testInfo.outputPath("about.png"), fullPage: true });
  await page.locator("#dialog-close").click();
  await page.locator("#menu").click();
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  await expect(page.getByAltText("MangoIdiots.com", { exact: true })).toBeVisible();
  await page.locator("#dialog-close").click();
  await page.locator("#menu").click();
  await page.getByRole("button", { name: "Theme collection", exact: true }).click();
  await expect(page.getByLabel("Available theme packs").locator("option")).toHaveCount(2);
  await expect(page.getByLabel("Available theme packs").locator('option[value="mughal@1.0.0"]')).toHaveText("Mughal Gardens");
});

test("Chola and Mughal switching preserves the board, both packs and logo reopen offline", async ({ page, context }, testInfo) => {
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await start(page); await stockClick(page);
  const before = await readSave(page);
  await useTheme(page, "mughal");
  await expect(page.locator("#theme-label")).toHaveText("Mughal Gardens");
  expect((await readSave(page)).board).toEqual(before.board);
  const palette = JSON.parse(await readFile("themes/mughal/manifest.json", "utf8")).palette;
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--table"))).toBe(palette.table);
  await page.screenshot({ path: testInfo.outputPath("mughal-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 360, height: 780 });
  await page.screenshot({ path: testInfo.outputPath("mughal-phone.png"), fullPage: true });
  await page.locator("#pause").click();
  await context.setOffline(true); await page.close();
  const reopened = await context.newPage(); await loaded(reopened);
  await expect(reopened.locator("#theme-label")).toHaveText("Mughal Gardens");
  expect((await readSave(reopened)).board).toEqual(before.board);
  await reopened.locator("#resume").click();
  await useTheme(reopened, "chola"); await useTheme(reopened, "mughal");
  await reopened.locator("#undo").click();
  expect((await readSave(reopened)).board.stock).toHaveLength(24);
  await reopened.locator("#menu").click();
  await reopened.getByRole("button", { name: "About Mangoidiots Solitaire", exact: true }).click();
  const logo = reopened.getByAltText("MangoIdiots.com", { exact: true });
  expect(await logo.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(errors).toEqual([]);
});

test("every Mughal SVG and WAV decodes in the browser", async ({ page }) => {
  await loaded(page); await useTheme(page, "mughal");
  const media = await page.evaluate(async () => {
    const base = new URL(document.baseURI);
    const cache = await caches.open(`mangoidiots-theme:${base.pathname}:mughal:1.0.0`);
    const metadata = await cache.match(new URL("_theme/mughal/1.0.0/manifest.json", base));
    const manifest = await metadata.json();
    const audio = new AudioContext();
    const counts = { images: 0, sounds: 0 };
    try {
      for (const file of manifest.files) {
        const response = await cache.match(new URL(`_theme/mughal/1.0.0/${file.path}`, base));
        if (file.mime === "image/svg+xml") {
          const url = URL.createObjectURL(await response.blob());
          try {
            const image = new Image(); image.src = url; await image.decode();
            if (!image.naturalWidth || !image.naturalHeight) throw new Error(`Empty image ${file.path}`);
            counts.images++;
          } finally { URL.revokeObjectURL(url); }
        } else if (file.mime === "audio/wav") {
          const decoded = await audio.decodeAudioData(await response.arrayBuffer());
          if (!decoded.length) throw new Error(`Empty sound ${file.path}`);
          counts.sounds++;
        }
      }
    } finally { await audio.close(); }
    return counts;
  });
  expect(media).toEqual({ images: 54, sounds: 6 });
});
