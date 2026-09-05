import { test, expect, chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync, zipSync } from "fflate";

import { root, loaded, start, readSave, stockClick, fixture } from "./helpers.js";

test("route types, scope, isolation, and packaged theme delivery", async ({ request }) => {
  const redirect = await request.get(root.slice(0, -1), { maxRedirects: 0 });
  expect(redirect.status()).toBe(308);
  const worker = await request.get(`${root}sw.js`);
  expect(worker.headers()["content-type"]).toContain("javascript");
  expect((await request.post(root)).status()).toBe(405);
  expect((await request.get(`${root}missing.js`)).status()).toBe(404);
  const list = await (await request.get(`${root}themes.json`)).json();
  expect(list.themes[0].id).toBe("chola");
  const zip = await request.get(new URL(list.themes[0].url, `http://127.0.0.1:4173${root}`).href);
  expect(zip.ok()).toBe(true);
  expect((await zip.body()).subarray(0, 2).toString()).toBe("PK");
  for (const path of ["/", "/admin/", "/blog/", "/another-app/"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain("Mangoidiots Solitaire");
  }
});

test("52-card game renders, stock responds, Undo and reload preserve exact board", async ({ page }) => {
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  const initial = await readSave(page);
  expect(initial.board.stock).toHaveLength(24);
  expect(initial.board.tableau.map((p) => p.cards.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  await stockClick(page);
  await expect(page.locator("#moves")).toHaveText("1");
  const moved = await readSave(page);
  expect(moved.board.stock).toHaveLength(23);
  expect(moved.board.waste).toHaveLength(1);
  await page.locator("#pause").click();
  await page.reload();
  await expect(page.locator("#loading")).toBeHidden();
  await expect(page.locator("#pause-overlay")).toBeVisible();
  expect((await readSave(page)).board).toEqual(moved.board);
  await page.locator("#resume").click();
  await page.locator("#undo").click();
  expect((await readSave(page)).board).toEqual(initial.board);
  expect((await readSave(page)).undoPenalty).toBe(2);
  expect(errors).toEqual([]);
});

test("legal card placement, reveal and Undo work through keyboard card controls", async ({ page }) => {
  await loaded(page);
  // A valid known position: red 7 can move onto black 8 and reveal the hidden Ace.
  await fixture(page, `
    const used = [0,19,7];
    current.board = {stock:Array.from({length:52},(_,i)=>i).filter(i=>!used.includes(i)),waste:[],
      tableau:[{cards:[0,19],faceUp:1},{cards:[7],faceUp:0},...Array.from({length:5},()=>({cards:[],faceUp:0}))],
      foundations:[[],[],[],[]]};
    current.undo=[]; current.movePoints=0; current.undoPenalty=0; current.elapsedMs=0; current.started=false;
    return current;
  `);
  await page.locator("#resume").click();
  await page.locator("#accessible-panel summary").click();
  await page.locator('[data-card-key="t0:1"]').focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Place on column 2", exact: true }).click();
  await expect(page.locator("#moves")).toHaveText("1");
  const state = await readSave(page);
  expect(state.board.tableau[0]).toEqual({ cards: [0], faceUp: 0 });
  expect(state.movePoints).toBe(5);
  await page.keyboard.press("Control+z");
  await expect(page.locator("#moves")).toHaveText("1");
  expect((await readSave(page)).board.tableau[0]).toEqual({ cards: [0, 19], faceUp: 1 });
});

test("dragging a card performs the same legal reveal as tap-to-move", async ({ page }) => {
  await loaded(page);
  await fixture(page, `
    const used=[0,19,7];
    current.board={stock:Array.from({length:52},(_,i)=>i).filter(i=>!used.includes(i)),waste:[],
      tableau:[{cards:[0,19],faceUp:1},{cards:[7],faceUp:0},...Array.from({length:5},()=>({cards:[],faceUp:0}))],
      foundations:[[],[],[],[]]};
    current.undo=[];return current;
  `);
  await page.locator("#resume").click();
  const box = await page.locator("#board canvas").boundingBox();
  const gap = box.width < 500 ? 5 : 14;
  const width = Math.min(126, (box.width - gap * 6 - 8) / 7);
  const left = (box.width - (width * 7 + gap * 6)) / 2;
  const tableau = width * 1.4 + (box.width < 600 ? 68 : 62);
  const backStep = Math.max(7, Math.min(12, width * .11));
  await page.mouse.move(box.x + left + width / 2, box.y + tableau + backStep + width * .6);
  await page.mouse.down();
  await page.mouse.move(box.x + left + width + gap + width / 2, box.y + tableau + width * .6, { steps: 15 });
  await page.mouse.up();
  await expect(page.locator("#moves")).toHaveText("1");
  expect((await readSave(page)).board.tableau[0]).toEqual({ cards: [0], faceUp: 0 });
});

for (const tier of ["Easy", "Medium", "Difficult"]) {
  test(`complete a ${tier} deal through real UI controls and recorded winning moves`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await start(page);
    if (tier !== "Easy") {
      await page.locator("#new-game").click();
      await page.locator(`input[name="difficulty"][value="${tier}"]`).check();
      await page.getByRole("button", { name: "Start new game", exact: true }).click();
    }
    const initial = await readSave(page);
    const witnesses = JSON.parse(await readFile("tools/deals/witnesses.json", "utf8"));
    const moves = witnesses[initial.dealId];
    await page.locator("#accessible-panel summary").click();
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      if (move.type === "draw") await page.getByRole("button", { name: /^Draw \(/ }).click();
      else if (move.type === "recycle") await page.getByRole("button", { name: "Recycle waste", exact: true }).click();
      else {
        await page.locator(`[data-card-key="${move.from}:${move.index}"]`).click();
        if (move.to.startsWith("f")) {
          await page.getByRole("button", { name: `Place on ${["spades", "hearts", "clubs", "diamonds"][Number(move.to[1])]}`, exact: true }).click();
        } else {
          await page.locator(".pile-list").filter({
            has: page.getByRole("heading", { name: `Column ${Number(move.to[1]) + 1}`, exact: true }),
          }).getByRole("button").last().click();
        }
      }
      await expect(page.locator("#moves")).toHaveText(String(i + 1));
    }
    await expect(page.locator("#dialog-title")).toHaveText("A royal victory.");
    expect((await readSave(page)).board.foundations.map((pile) => pile.length)).toEqual([13, 13, 13, 13]);
  });
}

test("hint explains a legal action without moving cards", async ({ page }) => {
  await start(page);
  const before = await readSave(page);
  await page.locator("#hint").click();
  await expect(page.locator("#message")).toContainText("Hints suggest legal moves");
  const after = await readSave(page);
  expect(after.board).toEqual(before.board);
  expect(after.hints).toBe(1);
});

test("time counts only during active play and pause survives reload", async ({ page }) => {
  await page.clock.install();
  await start(page); await stockClick(page);
  await page.clock.fastForward(31000);
  await expect(page.locator("#timer")).toHaveText(/^00:3[1-3]$/);
  await page.locator("#pause").click();
  const time = await page.locator("#timer").textContent();
  await page.clock.fastForward(60000);
  await expect(page.locator("#timer")).toHaveText(time);
  await page.reload();
  await expect(page.locator("#pause-overlay")).toBeVisible();
  await expect(page.locator("#timer")).toHaveText(time);
});

test("Reset preserves the deal and records the previous attempt exactly once", async ({ page }) => {
  await start(page); await stockClick(page);
  const previous = await readSave(page);
  await page.locator("#reset").click();
  await page.getByRole("button", { name: "Restart deal", exact: true }).click();
  await expect(page.locator("#moves")).toHaveText("0");
  const current = await readSave(page);
  expect(current.dealId).toBe(previous.dealId);
  expect(current.id).not.toBe(previous.id);
  await page.locator("#menu").click();
  await page.getByRole("button", { name: "Game history", exact: true }).click();
  await expect(page.locator("#dialog-body")).toContainText("1 past attempts");
  await expect(page.getByRole("cell", { name: "Restarted", exact: true })).toBeVisible();
});

test("difficulty selection chooses another verified deal", async ({ page }) => {
  await start(page); const previous = await readSave(page);
  await page.locator("#new-game").click();
  await page.locator('input[name="difficulty"][value="Difficult"]').check();
  await page.getByRole("button", { name: "Start new game", exact: true }).click();
  await expect(page.locator("#difficulty")).toHaveText("Difficult");
  expect((await readSave(page)).dealId).not.toBe(previous.dealId);
});

test("verified Auto-finish wins once and reload cannot award a second bonus", async ({ page }) => {
  await loaded(page);
  await fixture(page, `
    current.board={stock:[],waste:[],tableau:[{cards:[12],faceUp:0},...Array.from({length:6},()=>({cards:[],faceUp:0}))],
      foundations:[Array.from({length:12},(_,i)=>i),...Array.from({length:3},(_,s)=>Array.from({length:13},(_,i)=>(s+1)*13+i))]};
    current.undo=[];current.movePoints=600;current.undoPenalty=0;current.elapsedMs=60000;current.started=true;
    return current;
  `);
  await page.locator("#resume").click();
  await expect(page.locator("#finish")).toBeVisible();
  await page.locator("#finish").click();
  await expect(page.locator("#dialog-title")).toHaveText("A royal victory.");
  const won = await readSave(page);
  expect(won.status).toBe("won"); expect(won.bonus).toBeGreaterThan(10000);
  await page.reload();
  await expect(page.locator("#dialog-title")).toHaveText("A royal victory.");
  expect((await readSave(page)).bonus).toBe(won.bonus);
  await page.getByRole("button", { name: "View table / skip", exact: true }).click();
  await page.locator("#menu").click();
  await page.getByRole("button", { name: "Game history", exact: true }).click();
  await expect(page.locator("#dialog-body")).toContainText("1 past attempts");
});

test("mute and reduced effects survive reload", async ({ page }) => {
  await start(page); await page.locator("#mute").click();
  await expect(page.locator("#mute")).toHaveAttribute("aria-label", "Unmute sound");
  await page.locator("#menu").click();
  await page.getByRole("button", { name: "Sound & effects", exact: true }).click();
  await page.getByLabel("Reduce visual effects").check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(page.locator("#loading")).toBeHidden();
  await expect(page.locator("#mute")).toHaveAttribute("aria-label", "Unmute sound");
  await page.locator("#menu").click();
  await page.getByRole("button", { name: "Sound & effects", exact: true }).click();
  await expect(page.getByLabel("Reduce visual effects")).toBeChecked();
});

test("fresh offline tab restores full theme, board, audio URLs and Undo", async ({ page, context }) => {
  await start(page); await stockClick(page);
  await page.locator("#pause").click();
  const saved = await readSave(page);
  await context.setOffline(true); await page.close();
  const reopened = await context.newPage();
  await loaded(reopened);
  expect((await readSave(reopened)).board).toEqual(saved.board);
  await reopened.locator("#resume").click(); await reopened.locator("#undo").click();
  expect((await readSave(reopened)).board.stock).toHaveLength(24);
  await reopened.locator("#menu").click();
  await reopened.getByRole("button", { name: "Theme collection", exact: true }).click();
  await expect(reopened.locator(".theme-card img")).toBeVisible();
  expect(await reopened.locator(".theme-card img").evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
});

test("browser restart retains the entire offline game", async ({}, testInfo) => {
  const profile = testInfo.outputPath("browser-profile");
  const options = { channel: "chrome", headless: true, baseURL: "http://127.0.0.1:4173" };
  let context = await chromium.launchPersistentContext(profile, options);
  try {
    const page = await context.newPage(); await start(page); await stockClick(page);
    await page.locator("#pause").click(); const saved = await readSave(page);
    await context.close();
    context = await chromium.launchPersistentContext(profile, options);
    await context.setOffline(true);
    const reopened = await context.newPage(); await loaded(reopened);
    expect((await readSave(reopened)).board).toEqual(saved.board);
  } finally { await context.close(); }
});

test("nested Pages path and resume route preserve offline state", async ({ page, context }) => {
  await page.goto(root);
  await expect(page.locator("#loading")).toBeHidden({ timeout: 40000 });
  await page.locator("#resume").click(); await stockClick(page); await page.locator("#pause").click();
  const saved = await readSave(page);
  await context.setOffline(true);
  await page.goto(`${root}resume/`);
  await expect(page.locator("#loading")).toBeHidden();
  expect((await readSave(page)).board).toEqual(saved.board);
});

test("second tab cannot overwrite an active game's save", async ({ page, context }) => {
  await start(page);
  const second = await context.newPage(); await second.goto(root);
  await expect(second.locator("#loading-label")).toContainText("Another tab is already playing");
  await expect(second.locator("#loading")).toBeVisible();
});

test("interrupted theme download reports failure and retries without clearing storage", async ({ page, context }) => {
  await context.route("**/themes/chola-1.0.0.zip", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto(root);
  await expect(page.locator("#loading-label")).toContainText("Theme download failed", { timeout: 30000 });
  await expect(page.locator("#offline-status")).not.toHaveText("Ready offline");
  await context.unroute("**/themes/chola-1.0.0.zip");
  await page.locator("#retry-load").click();
  await expect(page.locator("#loading")).toBeHidden({ timeout: 40000 });
});

test("theme checksum or path tampering cannot activate a pack", async ({ page, context }) => {
  const entries = unzipSync(await readFile("generated/chola-pack.zip"));
  entries["../unexpected.js"] = new TextEncoder().encode("malicious asset");
  const invalid = zipSync(entries);
  await context.route("**/themes/chola-1.0.0.zip", (route) => route.fulfill({
    contentType: "application/zip", body: Buffer.from(invalid),
  }));
  await page.goto(root);
  await expect(page.locator("#loading-label")).toContainText("unsafe paths", { timeout: 30000 });
  await expect(page.locator("#offline-status")).not.toHaveText("Ready offline");
});

test("storage denial stops play with an honest error", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { value: { open() { throw new DOMException("Storage disabled", "SecurityError"); } } });
  });
  await page.goto(root);
  await expect(page.locator("#loading-label")).toContainText("Storage disabled");
  await expect(page.locator("#loading")).toBeVisible();
});

test("history retention keeps the newest 500 attempts", async ({ page }) => {
  await loaded(page);
  await page.goto("/__test__/blank");
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("mangoidiots-solitaire:/mangoidiots-solitaire/", 1);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction("history", "readwrite");
      for (let i = 0; i < 500; i++) tx.objectStore("history").put({
        id: `old-${i}`, dealId: "history-fixture", difficulty: "Easy", startedAt: "2020-01-01T00:00:00.000Z",
        endedAt: new Date(Date.UTC(2020, 0, 1, 0, i)).toISOString(), result: "Abandoned", score: 0, elapsedMs: 0, moves: 0, hints: 0, undos: 0,
      });
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error);
    };
  }));
  await loaded(page); await page.locator("#resume").click();
  await page.locator("#reset").click(); await page.getByRole("button", { name: "Restart deal", exact: true }).click();
  await page.locator("#menu").click(); await page.getByRole("button", { name: "Game history", exact: true }).click();
  await expect(page.locator("#dialog-body")).toContainText("500 past attempts");
  const oldest = await page.evaluate(() => new Promise((resolve) => {
    const request = indexedDB.open("mangoidiots-solitaire:/mangoidiots-solitaire/", 1);
    request.onsuccess = () => {
      const db = request.result, read = db.transaction("history").objectStore("history").get("old-0");
      read.onsuccess = () => { db.close(); resolve(read.result); };
    };
  }));
  expect(oldest).toBeUndefined();
});

test("corrupt current save is retained and clearly reported", async ({ page }) => {
  await loaded(page);
  await page.goto("/__test__/blank");
  await page.evaluate(() => new Promise((resolve) => {
    const request = indexedDB.open("mangoidiots-solitaire:/mangoidiots-solitaire/", 1);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction("state", "readwrite");
      tx.objectStore("state").put({ schemaVersion: 999, id: "preserve-me" }, "current");
      tx.oncomplete = () => { db.close(); resolve(); };
    };
  }));
  await page.goto(root);
  await expect(page.locator("#loading-label")).toContainText("has not been overwritten");
  expect((await readSave(page)).id).toBe("preserve-me");
});

test("phone portrait and landscape retain seven columns without horizontal overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await start(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("phone.png"), fullPage: true });
  await page.locator("#accessible-panel summary").click();
  await expect(page.getByRole("heading", { name: "Column 7", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 780, height: 360 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("landscape.png"), fullPage: true });
});

test("desktop presentation has all card assets without runtime exceptions", async ({ page }, testInfo) => {
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1366, height: 950 });
  await start(page);
  await page.screenshot({ path: testInfo.outputPath("desktop.png"), fullPage: true });
  expect(await page.locator("#board canvas").count()).toBe(1);
  expect(errors).toEqual([]);
});
