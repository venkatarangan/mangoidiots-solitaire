import { test, expect } from "@playwright/test";
import { loaded, readSave, stockClick, fixture, layout } from "./helpers.js";

async function selectTheme(page, id) {
  await page.getByRole("button", { name: "Choose theme", exact: true }).click();
  await expect(page.locator("#dialog-title")).toHaveText("Theme collection");
  await page.getByLabel("Available theme packs").selectOption(`${id}@1.0.0`);
  const name = await page.getByLabel("Available theme packs").locator("option:checked").textContent();
  await page.getByRole("button", { name: "Use theme", exact: true }).click();
  await expect(page.locator("#theme-label")).toHaveText(name);
  await expect(page.locator("#loading")).toBeHidden();
  await expect(page.locator("#error")).toBeHidden();
}

async function pileFixture(page, kind, suit = 0, rank = 3) {
  await fixture(page, `
    const foundations=Array.from({length:4},(_,s)=>value.kind==="foundation" && s===value.suit
      ? Array.from({length:value.rank},(_,r)=>s*13+r) : []);
    const waste=value.kind==="waste" ? [1,19] : [];
    const target=value.kind==="waste" ? 7 : (value.suit%2 ? 0 : 13)+value.rank;
    const used=[...foundations.flat(),...waste,target];
    current.board={stock:Array.from({length:52},(_,i)=>i).filter(i=>!used.includes(i)),waste,foundations,
      tableau:[{cards:[target],faceUp:0},...Array.from({length:6},()=>({cards:[],faceUp:0}))]};
    current.undo=[];current.movePoints=0;current.undoPenalty=0;current.moves=0;
    current.elapsedMs=0;current.started=false;return current;
  `, { kind, suit, rank });
}

async function compareHeldPile(page, kind, suit = 0, rank = 3, testInfo) {
  await page.locator("#resume").click();
  const before = await readSave(page), l = await layout(page);
  const x = l.x(kind === "waste" ? 1 : suit + 3);
  const clip = { x: Math.ceil(x + 3), y: Math.ceil(l.top + 3), width: Math.floor(l.width - 6), height: Math.floor(l.height - 6) };
  const image = () => page.screenshot({ clip });
  const drag = async () => {
    await page.mouse.move(x + l.width / 2, l.top + l.height / 2);
    await page.mouse.down();
    await page.mouse.move(l.x(0) + l.width / 2, l.tableau + l.height / 2, { steps: 12 });
    await expect(page.locator("#message")).toHaveText("Release to place on column 1.");
  };
  const covered = await image();
  await drag();
  const exposed = await image();
  expect(exposed.equals(covered)).toBe(false);
  expect((await readSave(page)).board).toEqual(before.board);
  if (testInfo) await page.screenshot({ path: testInfo.outputPath("foundation-underlay.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect((await image()).equals(covered)).toBe(true);
  expect((await readSave(page)).board).toEqual(before.board);
  await drag(); await page.mouse.up();
  await expect(page.locator("#moves")).toHaveText("1");
  const moved = await readSave(page);
  if (kind === "foundation") {
    expect(moved.board.foundations[suit]).toHaveLength(rank - 1);
    expect(moved.movePoints).toBe(-15);
  } else {
    expect(moved.board.waste).toEqual([1]);
    expect(moved.movePoints).toBe(5);
  }
  // Compare actual pixels with the now-committed underlying card, not just saved state.
  expect((await image()).equals(exposed)).toBe(true);
  await page.locator("#undo").click();
  expect((await readSave(page)).board).toEqual(before.board);
  expect((await image()).equals(covered)).toBe(true);
}

for (const theme of ["chola", "mughal"]) {
  for (let suit = 0; suit < 4; suit++) {
    test(`foundation underlay ${theme} suit ${suit} is visible during drag and restored on cancellation/Undo`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: suit % 2 ? 360 : 1280, height: 950 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await loaded(page); await pileFixture(page, "foundation", suit);
      if (theme !== "chola") await selectTheme(page, theme);
      await compareHeldPile(page, "foundation", suit, 3, suit === 3 ? testInfo : undefined);
    });
  }
  test(`waste underlay ${theme} stays visible without moving the covered card`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 950 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await loaded(page); await pileFixture(page, "waste");
    if (theme !== "chola") await selectTheme(page, theme);
    await compareHeldPile(page, "waste");
  });
}

test("a foundation containing only its Ace reveals an empty slot while dragging", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 950 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loaded(page); await pileFixture(page, "foundation", 0, 1);
  await compareHeldPile(page, "foundation", 0, 1);
});

for (const width of [320, 780, 1366]) {
  test(`main-screen Themes control at ${width}px preserves pause, progress and offline switching`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await loaded(page);
    const chooser = page.getByRole("button", { name: "Choose theme", exact: true });
    await expect(chooser).toBeVisible();
    await expect(chooser).toContainText("Themes");
    const box = await chooser.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await chooser.focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#dialog-title")).toHaveText("Theme collection");
    await page.locator("#dialog-close").click();
    await expect(page.locator("#pause-overlay")).toBeVisible();
    const initial = await readSave(page);
    await selectTheme(page, "mughal");
    await expect(page.locator("#pause-overlay")).toBeVisible();
    expect((await readSave(page)).board).toEqual(initial.board);
    await page.locator("#resume").click(); await stockClick(page);
    const playing = await readSave(page);
    await selectTheme(page, "chola");
    await expect(page.locator("#pause-overlay")).toBeHidden();
    expect((await readSave(page)).board).toEqual(playing.board);
    expect((await readSave(page)).undo).toEqual(playing.undo);
    await context.setOffline(true);
    await selectTheme(page, "mughal");
    expect((await readSave(page)).board).toEqual(playing.board);
    await page.screenshot({ path: testInfo.outputPath("themes-main-screen.png"), fullPage: true });
    await page.locator("#menu").click();
    await expect(page.getByRole("button", { name: "Theme collection", exact: true })).toBeVisible();
  });
}
