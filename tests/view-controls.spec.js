import { test, expect } from "./browser-fixtures.js";
import { loaded, start, fixture, layout, readSave } from "./helpers.js";

const longRun = `
  const run=Array.from({length:13},(_,i)=>(i%2 ? 13 : 0)+12-i);
  const rest=Array.from({length:52},(_,i)=>i).filter(i=>!run.includes(i));
  current.board={stock:rest,waste:[],foundations:[[],[],[],[]],
    tableau:[{cards:run,faceUp:0},...Array.from({length:6},()=>({cards:[],faceUp:0}))]};
  current.undo=[];current.started=false;return current;
`;
const lastCard = `
  current.board={stock:[],waste:[],tableau:[{cards:[12],faceUp:0},...Array.from({length:6},()=>({cards:[],faceUp:0}))],
    foundations:[Array.from({length:12},(_,i)=>i),...Array.from({length:3},(_,s)=>Array.from({length:13},(_,i)=>(s+1)*13+i))]};
  current.undo=[];current.elapsedMs=60000;current.started=true;return current;
`;

test("landscape keeps long runs large and scrollable, with zoom and a Fit overview", async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 300 });
  await loaded(page); await fixture(page, longRun); await page.locator("#resume").click();
  const before = await readSave(page), original = await layout(page);
  expect(original.width * 86 / 240).toBeGreaterThan(18);
  const viewport = page.locator("#board-viewport");
  expect(await viewport.evaluate((v) => v.scrollHeight > v.clientHeight)).toBe(true);
  await page.locator("#pan-table").click();
  await expect(page.locator("#pan-table")).toHaveAttribute("aria-pressed", "true");
  const bounds = await viewport.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, 240);
  await expect.poll(() => viewport.evaluate((v) => v.scrollTop)).toBeGreaterThan(100);
  expect((await readSave(page)).board).toEqual(before.board);
  await page.locator("#zoom-in").click();
  await expect(page.locator("#zoom-level")).toHaveText("125%");
  expect((await layout(page)).width).toBeGreaterThan(original.width * 1.2);
  expect(await viewport.evaluate((v) => v.scrollWidth > v.clientWidth)).toBe(true);
  await page.locator("#zoom-out").click();
  await expect(page.locator("#zoom-level")).toHaveText("100%");
  await page.locator("#zoom-fit").click();
  await expect(page.locator("#zoom-level")).toHaveText("Fit");
  await expect.poll(() => viewport.evaluate((v) => v.scrollHeight - v.clientHeight)).toBeLessThanOrEqual(1);
  expect(await viewport.evaluate((v) => v.scrollWidth - v.clientWidth)).toBeLessThanOrEqual(1);
  expect((await readSave(page)).board).toEqual(before.board);
});

test.describe("Magnified Retina table", () => {
  test.use({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, reducedMotion: "reduce" });
  test("drag coordinates stay accurate after horizontal and vertical scrolling", async ({ page }) => {
    await loaded(page);
    await fixture(page, `
      current.board={stock:Array.from({length:51},(_,i)=>i+1),waste:[0],foundations:[[],[],[],[]],
        tableau:Array.from({length:7},()=>({cards:[],faceUp:0}))};
      current.undo=[];current.started=false;return current;
    `);
    await page.locator("#resume").click();
    const before = await readSave(page);
    for (const text of ["125%", "150%"]) {
      await page.locator("#zoom-in").click();
      await expect(page.locator("#zoom-level")).toHaveText(text);
    }
    await page.locator("#board-viewport").evaluate((v) => v.scrollTo(40, 100));
    await expect.poll(() => page.locator("#board-viewport").evaluate((v) => v.scrollTop)).toBe(100);
    const l = await layout(page), source = l.piles.waste, target = l.piles.f0;
    await page.mouse.move(source.x + l.width * .9, source.y + l.height * .85);
    await page.mouse.down();
    await page.mouse.move(target.x + l.width * .9, target.y + l.height * .85, { steps: 12 });
    await expect(page.locator("#message")).toHaveText("Release to place on the spades foundation.");
    await page.mouse.up();
    await expect.poll(async () => (await readSave(page)).board.foundations[0]).toEqual([0]);
    await page.locator("#undo").click();
    expect((await readSave(page)).board).toEqual(before.board);
  });
});

test("touch Scroll mode pans across cards without changing the game", async ({ page, context }) => {
  await page.setViewportSize({ width: 667, height: 300 });
  await loaded(page); await fixture(page, longRun); await page.locator("#resume").click();
  const before = await readSave(page);
  await page.locator("#pan-table").click();
  const l = await layout(page);
  const x = l.piles.t0.x + l.width / 2, y = l.box.y + 155;
  const cdp = await context.newCDPSession(page);
  try {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - i * 12 }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => page.locator("#board-viewport").evaluate((v) => v.scrollTop)).toBeGreaterThan(40);
    expect((await readSave(page)).board).toEqual(before.board);
    await page.locator("#pan-table").click();
    await expect(page.locator("#pan-table")).toHaveAttribute("aria-pressed", "false");
  } finally { await cdp.detach(); }
});

test("native card controls do not click through to the clipped portion of a tall canvas", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await loaded(page);
  await fixture(page, longRun.replace("stock:rest,waste:[]", "stock:rest.filter(c=>c!==13),waste:[13]"));
  await page.locator("#resume").click();
  const before = await readSave(page);
  await page.locator("#accessible-panel summary").click();
  await page.getByRole("button", { name: "Ace of hearts", exact: true }).click();
  await page.getByRole("button", { name: "Place on hearts", exact: true }).click();
  await expect(page.locator("#moves")).toHaveText("1");
  const after = await readSave(page);
  expect(after.board.stock).toEqual(before.board.stock);
  expect(after.board.foundations[1]).toEqual([13]);
  expect(after.board.tableau).toEqual(before.board.tableau);
});

test("zoom and custom background persist offline and survive a theme change", async ({ page, context }) => {
  await start(page);
  const before = await readSave(page);
  await page.locator("#zoom-in").click();
  await expect(page.locator("#zoom-level")).toHaveText("125%");
  await page.locator("#table-settings").click();
  await page.getByRole("button", { name: "Ivory", exact: true }).click();
  await expect(page.locator("#board-viewport")).toHaveCSS("background-color", "rgb(245, 237, 219)");
  await page.getByLabel("Custom background colour").fill("#b0c4de");
  await page.getByLabel("Custom background colour").dispatchEvent("change");
  await expect(page.locator("#board-viewport")).toHaveCSS("background-color", "rgb(176, 196, 222)");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.locator("#themes").click();
  await page.getByLabel("Available theme packs").selectOption("mughal@1.1.0");
  await page.getByRole("button", { name: "Use theme", exact: true }).click();
  await expect(page.locator("#theme-label")).toHaveText("Mughal Gardens", { timeout: 40000 });
  await expect(page.locator("#loading")).toBeHidden();
  await expect(page.locator("#board-viewport")).toHaveCSS("background-color", "rgb(176, 196, 222)");
  await page.locator("#pause").click();
  await context.setOffline(true);
  await loaded(page);
  await expect(page.locator("#zoom-level")).toHaveText("125%");
  await expect(page.locator("#board-viewport")).toHaveCSS("background-color", "rgb(176, 196, 222)");
  expect((await readSave(page)).board).toEqual(before.board);
  await page.locator("#table-settings").click();
  await page.getByRole("button", { name: "Use theme background", exact: true }).click();
  await expect(page.locator("#board-viewport")).toHaveCSS("background-color", "rgb(23, 59, 83)");
});

test("older preferences gain safe display defaults and zoom controls respect their limits", async ({ page }) => {
  await loaded(page);
  const before = await readSave(page);
  const defaultColour = await page.locator("#board-viewport").evaluate((v) => getComputedStyle(v).backgroundColor);
  await page.goto("/__test__/blank");
  await page.evaluate(async () => new Promise((resolve, reject) => {
    const request = indexedDB.open("mangoidiots-solitaire:/mangoidiots-solitaire/", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction("state", "readwrite"), store = tx.objectStore("state");
      const read = store.get("preferences");
      read.onsuccess = () => {
        const prefs = read.result;
        delete prefs.zoom; delete prefs.background;
        store.put(prefs, "preferences");
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => reject(tx.error);
    };
  }));
  await loaded(page);
  await expect(page.locator("#zoom-level")).toHaveText("100%");
  await expect(page.locator("#board-viewport")).toHaveCSS("background-color", defaultColour);
  await page.locator("#zoom-out").click();
  await expect(page.locator("#zoom-level")).toHaveText("75%");
  await expect(page.locator("#zoom-out")).toBeDisabled();
  for (const text of ["100%", "125%", "150%", "175%", "200%"]) {
    await page.locator("#zoom-in").click();
    await expect(page.locator("#zoom-level")).toHaveText(text);
  }
  await expect(page.locator("#zoom-in")).toBeDisabled();
  expect((await readSave(page)).board).toEqual(before.board);
  expect((await readSave(page)).started).toBe(before.started);
});

for (const reduced of [false, true]) {
  test.describe(`Victory with reduced effects ${reduced}`, () => {
    test.use({ reducedMotion: reduced ? "reduce" : "no-preference" });
    test("completion displays a visible celebration, cleans up, and does not replay on reload", async ({ page }) => {
      await loaded(page); await fixture(page, lastCard); await page.locator("#resume").click();
      if (reduced) {
        await page.locator("#menu").click();
        await page.getByRole("button", { name: "Card list & keyboard play", exact: true }).click();
        await page.getByRole("button", { name: "King of spades", exact: true }).click();
        await page.getByRole("button", { name: "Place on spades", exact: true }).click();
        await expect(page.locator("#keyboard-dialog")).not.toBeVisible();
      } else {
        await page.locator("#finish").click();
      }
      await expect(page.locator("#dialog-title")).toHaveText("A royal victory.");
      await expect(page.locator(".victory-celebration")).toBeVisible();
      await expect(page.locator(".victory-celebration")).toHaveAttribute("data-state", reduced ? "static" : "animated");
      if (!reduced) {
        const firstFrame = await page.locator(".victory-celebration").screenshot();
        await expect.poll(async () => (await page.locator(".victory-celebration").screenshot()).equals(firstFrame)).toBe(false);
      }
      const won = await readSave(page);
      expect(won.status).toBe("won");
      await page.getByRole("button", { name: "View table / skip", exact: true }).click();
      await expect(page.locator(".victory-celebration")).toHaveCount(0);
      await loaded(page);
      await expect(page.locator("#dialog-title")).toHaveText("A royal victory.");
      await expect(page.locator(".victory-celebration[data-state=animated]")).toHaveCount(0);
      expect((await readSave(page)).bonus).toBe(won.bonus);
    });
  });
}
