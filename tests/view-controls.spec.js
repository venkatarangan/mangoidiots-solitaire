import { test, expect } from "./browser-fixtures.js";
import { readFile } from "node:fs/promises";
import { loaded, start, fixture, layout, readSave, displayAction } from "./helpers.js";

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
  await displayAction(page, "pan-table");
  await expect(page.locator("#pan-table")).toHaveAttribute("aria-pressed", "true");
  const bounds = await viewport.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, 240);
  await expect.poll(() => viewport.evaluate((v) => v.scrollTop)).toBeGreaterThan(100);
  expect((await readSave(page)).board).toEqual(before.board);
  await displayAction(page, "zoom-in");
  await expect(page.locator("#zoom-level")).toHaveText("125%");
  expect((await layout(page)).width).toBeGreaterThan(original.width * 1.2);
  expect(await viewport.evaluate((v) => v.scrollWidth > v.clientWidth)).toBe(true);
  await displayAction(page, "zoom-out");
  await expect(page.locator("#zoom-level")).toHaveText("100%");
  await displayAction(page, "zoom-fit");
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
      await displayAction(page, "zoom-in");
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
  await displayAction(page, "pan-table");
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
    await displayAction(page, "pan-table");
    await expect(page.locator("#pan-table")).toHaveAttribute("aria-pressed", "false");
  } finally { await cdp.detach(); }
});

test("laptop native card controls do not click through to the clipped portion of a tall canvas", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await loaded(page);
  await fixture(page, longRun.replace("stock:rest,waste:[]", "stock:rest.filter(c=>c!==13),waste:[13]"));
  await page.locator("#resume").click();
  const before = await readSave(page);
  await page.locator("#menu").click();
  await page.getByRole("button", { name: "Card list & keyboard play", exact: true }).click();
  await page.getByRole("button", { name: "Ace of hearts", exact: true }).click();
  await page.getByRole("button", { name: "Place on hearts", exact: true }).click();
  await expect(page.locator("#moves")).toHaveText("1");
  const after = await readSave(page);
  expect(after.board.stock).toEqual(before.board.stock);
  expect(after.board.foundations[1]).toEqual([13]);
  expect(after.board.tableau).toEqual(before.board.tableau);
});

test("laptop numeric zoom scrolls both axes with accurate rail-offset drag targets and stable height", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await loaded(page);
  await fixture(page, longRun.replace("stock:rest,waste:[]", "stock:rest.filter(c=>c!==13),waste:[13]"));
  await page.locator("#resume").click();
  const before = await readSave(page);
  const viewport = page.locator("#board-viewport");
  const viewportHeight = await viewport.evaluate(v => v.clientHeight);
  const natural = await layout(page);
  for (const zoom of ["125%", "150%"]) {
    await displayAction(page, "zoom-in");
    await expect(page.locator("#zoom-level")).toHaveText(zoom);
  }
  expect((await layout(page)).width).toBeCloseTo(natural.width * 1.5);
  await viewport.evaluate(v => v.scrollTo(40, 100));
  await expect.poll(() => viewport.evaluate(v => [v.scrollLeft, v.scrollTop])).toEqual([40, 100]);
  const l = await layout(page);
  const source = l.piles.waste, target = l.piles.f1;
  await page.mouse.move(source.x + l.width * .8, source.y + l.height * .85);
  await page.mouse.down();
  await page.mouse.move(target.x + l.width * .8, target.y + l.height * .85, { steps: 12 });
  await expect(page.locator("#message")).toHaveText("Release to place on the hearts foundation.");
  await page.mouse.up();
  await expect.poll(async () => (await readSave(page)).board.foundations[1]).toEqual([13]);
  expect(await viewport.evaluate(v => v.clientHeight)).toBe(viewportHeight);
  await page.locator("#undo").click();
  expect((await readSave(page)).board).toEqual(before.board);
  await viewport.evaluate(v => v.scrollTo(0, v.scrollHeight));
  const bottom = await layout(page);
  const bounds = await viewport.boundingBox();
  expect(bottom.box.y + bottom.geometry.columns[0].cardY.at(-1) + bottom.height).toBeLessThanOrEqual(bounds.y + bounds.height);
  await displayAction(page, "zoom-fit");
  await expect.poll(() => viewport.evaluate(v => [v.scrollLeft, v.scrollTop, v.scrollHeight - v.clientHeight])).toEqual([0, 0, 0]);
  expect(await viewport.evaluate(v => v.clientHeight)).toBe(viewportHeight);
  // A height-only resize must cancel a drag even when numeric canvas extents stay unchanged.
  await displayAction(page, "zoom-in");
  const held = await layout(page);
  await page.mouse.move(held.piles.waste.x + held.width / 2, held.piles.waste.y + held.height / 2);
  await page.mouse.down();
  await page.mouse.move(held.piles.f1.x + held.width / 2, held.piles.f1.y + held.height / 2, { steps: 12 });
  await expect(page.locator("#message")).toHaveText("Release to place on the hearts foundation.");
  await page.setViewportSize({ width: 1024, height: 620 });
  await expect.poll(() => viewport.evaluate(v => v.clientHeight)).not.toBe(viewportHeight);
  await page.mouse.up();
  expect((await readSave(page)).board).toEqual(before.board);
});

test("laptop responsive boundaries preserve portrait controls and short-landscape piles", async ({ page }) => {
  await start(page);
  await displayAction(page, "zoom-fit");
  for (const [width, height, laptop, side] of [
    [999,650,false,false], [1000,650,true,false], [1001,650,true,false],
    [1280,499,false,true], [1280,500,false,true], [1280,501,true,false],
    [1280,799,true,false], [1280,800,true,false], [1280,801,false,false],
    [1093,520,true,false], [1024,533,true,false],
    [1920,1080,false,false], [390,700,false,false], [932,430,false,true],
  ]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.locator("html").evaluate(e => e.classList.contains("laptop-play"))).toBe(laptop);
    await expect.poll(async () => (await layout(page)).geometry.side).toBe(side);
    expect(await page.locator("#zoom-fit").count()).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const board = await page.locator("#board-viewport").boundingBox();
    const compact = width > height && height <= 500;
    if (compact) {
      await expect(page.locator("#view-controls")).toBeHidden();
      await expect(page.locator("#display-controls")).toBeVisible();
      const trigger = await page.locator("#display-controls").boundingBox();
      const pause = await page.locator("#pause").boundingBox();
      expect(trigger.y).toBeGreaterThanOrEqual(pause.y + pause.height);
      expect(board.y).toBeLessThan(55);
      await page.locator("#display-controls").click();
      await expect(page.locator("#display-controls")).toHaveAttribute("aria-expanded", "true");
      const display = await page.locator("#view-controls").boundingBox();
      expect(display.x + display.width).toBeLessThanOrEqual(trigger.x);
      for (const selector of ["#zoom-out", "#zoom-in", "#zoom-fit", "#pan-table", "#table-settings"]) {
        const target = await page.locator(selector).boundingBox();
        expect(target.width, selector).toBeGreaterThanOrEqual(44);
        expect(target.height, selector).toBeGreaterThanOrEqual(44);
      }
      await page.keyboard.press("Escape");
      await expect(page.locator("#view-controls")).toBeHidden();
      await expect(page.locator("#display-controls")).toBeFocused();
    } else if (laptop) {
      const display = await page.locator("#view-controls").boundingBox();
      expect(display.x + display.width).toBeLessThanOrEqual(board.x);
      expect(display.y).toBeCloseTo(board.y);
    } else {
      const display = await page.locator("#view-controls").boundingBox();
      expect(display.y + display.height).toBeLessThanOrEqual(board.y);
    }
  }
});

test("mobile landscape Display popover preserves table height and existing controls", async ({ page }) => {
  const { version } = JSON.parse(await readFile("package.json", "utf8"));
  await page.setViewportSize({ width: 667, height: 300 });
  await start(page);
  const before = await readSave(page);
  const viewport = page.locator("#board-viewport");
  const tableHeight = await viewport.evaluate((node) => node.clientHeight);
  await expect(page.locator("footer")).toBeHidden();
  await page.locator("#menu").click();
  await expect(page.locator("#dialog-body .app-version")).toHaveText(`Version ${version}`);
  await page.getByRole("button", { name: "Return to game", exact: true }).click();

  await page.locator("#display-controls").click();
  await displayAction(page, "zoom-out");
  await expect(page.locator("#zoom-level")).toHaveText("75%");
  await displayAction(page, "zoom-fit");
  await expect(page.locator("#zoom-level")).toHaveText("Fit");
  await displayAction(page, "pan-table");
  await expect(page.locator("#pan-table")).toHaveAttribute("aria-pressed", "true");
  expect(await viewport.evaluate((node) => node.clientHeight)).toBe(tableHeight);
  expect((await readSave(page)).board).toEqual(before.board);

  await displayAction(page, "table-settings");
  await expect(page.locator("#dialog-title")).toHaveText("Table appearance");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator("#display-controls")).toBeFocused();
  expect(await viewport.evaluate((node) => node.clientHeight)).toBe(tableHeight);

  await page.locator("#display-controls").click();
  await page.locator("#score").click();
  await expect(page.locator("#view-controls")).toBeHidden();
});

test("laptop status and errors reserve space without covering cards or essential actions", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 501 });
  await loaded(page); await fixture(page, longRun); await page.locator("#resume").click();
  await displayAction(page, "zoom-fit");
  const viewport = page.locator("#board-viewport");
  const originalHeight = await viewport.evaluate(v => v.clientHeight);
  await page.evaluate(() => {
    const error = document.getElementById("error");
    error.hidden = false;
    error.textContent = "Test storage warning. ".repeat(60);
    document.getElementById("message").textContent = "Test status remains available. ".repeat(20);
  });
  await expect.poll(async () => (await layout(page)).geometry.height).toBeLessThan(originalHeight);
  const geometry = await layout(page);
  const table = await viewport.boundingBox(), error = await page.locator("#error").boundingBox();
  const status = await page.locator("#message").boundingBox(), actions = await page.locator(".toolbar").boundingBox();
  expect(table.y + table.height).toBeLessThanOrEqual(status.y);
  expect(status.y + status.height).toBeLessThanOrEqual(error.y);
  expect(error.y + error.height).toBeLessThanOrEqual(actions.y);
  expect(actions.y + actions.height).toBeLessThanOrEqual(501);
  expect(geometry.geometry.columns[0].cardY.at(-1) + geometry.height + 12).toBeLessThanOrEqual(table.height + .001);
  expect(await page.locator("#error").evaluate(e => e.scrollHeight > e.clientHeight)).toBe(true);
  await page.locator("#error").evaluate(e => e.scrollTop = e.scrollHeight);
  expect(await page.locator("#error").evaluate(e => e.scrollTop)).toBeGreaterThan(0);
  await expect(page.locator("#error")).toHaveAttribute("role", "alert");
  await expect(page.locator("#message")).toHaveAttribute("role", "status");
});

test("zoom and custom background persist offline and survive a theme change", async ({ page, context }) => {
  const appColour = async (colour, ink) => {
    for (const selector of ["html", "body", "#board-viewport", "#pause-overlay"]) {
      await expect(page.locator(selector)).toHaveCSS("background-color", colour);
    }
    await expect(page.locator("body")).toHaveCSS("background-image", "none");
    for (const selector of [".brand", ".metric-label", "#theme-label", "#zoom-level", "#menu", "#pause", "footer"]) {
      await expect(page.locator(selector).first()).toHaveCSS("color", ink);
    }
  };
  await start(page);
  const before = await readSave(page);
  await displayAction(page, "zoom-in");
  await expect(page.locator("#zoom-level")).toHaveText("125%");
  await displayAction(page, "table-settings");
  await page.getByRole("button", { name: "Forest", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await appColour("rgb(16, 62, 56)", "rgb(255, 255, 255)");
  const box = await page.locator("#board canvas").boundingBox();
  const screenshot = (await page.screenshot()).toString("base64");
  const pixels = await page.evaluate(async ({ screenshot, x, y }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${screenshot}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    return [[0, 0], [x, y]].map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data));
  }, { screenshot, x: Math.ceil(box.x + 1), y: Math.ceil(box.y + 1) });
  expect(pixels).toEqual([[16, 62, 56, 255], [16, 62, 56, 255]]);
  await displayAction(page, "table-settings");
  await page.getByRole("button", { name: "Ivory", exact: true }).click();
  await appColour("rgb(245, 237, 219)", "rgb(0, 0, 0)");
  await page.getByLabel("Custom background colour").fill("#b0c4de");
  await page.getByLabel("Custom background colour").dispatchEvent("change");
  await expect(page.locator("#board-viewport")).toHaveCSS("background-color", "rgb(176, 196, 222)");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await displayAction(page, "pan-table");
  await expect(page.locator("#pan-table")).toHaveCSS("color", "rgb(176, 196, 222)");
  await expect(page.locator("#pan-table")).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await displayAction(page, "pan-table");
  await page.locator("#themes").click();
  await page.getByLabel("Available theme packs").selectOption("mughal@1.1.0");
  await page.getByRole("button", { name: "Use theme", exact: true }).click();
  await expect(page.locator("#theme-label")).toHaveText("Mughal Gardens", { timeout: 40000 });
  await expect(page.locator("#loading")).toBeHidden();
  await appColour("rgb(176, 196, 222)", "rgb(0, 0, 0)");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#b0c4de");
  await page.locator("#pause").click();
  await context.setOffline(true);
  await loaded(page);
  await expect(page.locator("#zoom-level")).toHaveText("125%");
  await appColour("rgb(176, 196, 222)", "rgb(0, 0, 0)");
  expect((await readSave(page)).board).toEqual(before.board);
  await displayAction(page, "table-settings");
  await page.getByRole("button", { name: "Use theme background", exact: true }).click();
  await expect(page.locator("#board-viewport")).toHaveCSS("background-color", "rgb(23, 59, 83)");
  await expect(page.locator("html")).not.toHaveClass(/custom-background/);
  expect(await page.locator("body").evaluate((body) => getComputedStyle(body).backgroundImage)).toContain("radial-gradient");
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
  await displayAction(page, "zoom-out");
  await expect(page.locator("#zoom-level")).toHaveText("75%");
  await expect(page.locator("#zoom-out")).toBeDisabled();
  for (const text of ["100%", "125%", "150%", "175%", "200%"]) {
    await displayAction(page, "zoom-in");
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
