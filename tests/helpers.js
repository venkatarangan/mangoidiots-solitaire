import { expect } from "@playwright/test";

export const root = "/mangoidiots-solitaire/";
export const storageKey = `mangoidiots-solitaire:${root}`;
export async function loaded(page) {
  await page.goto(root);
  await expect(page.locator("#loading")).toBeHidden({ timeout: 40000 });
  await expect(page.locator("#offline-status")).toHaveText("Ready offline");
}
export async function start(page) { await loaded(page); await page.locator("#resume").click(); }
export async function readSave(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open(`mangoidiots-solitaire:${new URL(document.baseURI).pathname}`, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction("state").objectStore("state").get("current");
      read.onsuccess = () => { db.close(); resolve(read.result); };
      read.onerror = () => reject(read.error);
    };
  }));
}
export async function layout(page) {
  const box = await page.locator("#board canvas").boundingBox();
  const gap = box.width < 500 ? 5 : 14;
  const width = Math.min(126, (box.width - gap * 6 - 8) / 7);
  const left = (box.width - (width * 7 + gap * 6)) / 2;
  return {
    box, width, height: width * 1.4, x: (column) => box.x + left + column * (width + gap),
    top: box.y + 12, tableau: box.y + width * 1.4 + (box.width < 600 ? 68 : 62),
    faceStep: Math.max(11, Math.min(32, width * .27)), backStep: Math.max(7, Math.min(12, width * .11)),
  };
}
export async function stockClick(page) {
  const l = await layout(page);
  await page.mouse.click(l.x(0) + l.width / 2, l.top + l.height / 2);
}
export async function fixture(page, change, value) {
  await page.goto("/__test__/blank");
  await page.evaluate(async ({ source, value }) => {
    // Test-only code, evaluated on the harness homepage, never part of the game.
    const modify = new Function("current", "value", source);
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("mangoidiots-solitaire:/mangoidiots-solitaire/", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction("state", "readwrite");
        const store = tx.objectStore("state"), read = store.get("current");
        read.onsuccess = () => store.put(modify(read.result, value), "current");
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => reject(tx.error);
      };
    });
  }, { source: change, value });
  await loaded(page);
}
