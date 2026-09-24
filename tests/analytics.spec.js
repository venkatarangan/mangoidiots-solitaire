import { test, expect } from "./browser-fixtures.js";
import { loaded, start, stockClick, readSave } from "./helpers.js";

const googleHost = /(^|\.)(google-analytics\.com|analytics\.google\.com|googletagmanager\.com)$/;

test("analytics stays off on test hosts and never touches offline play", async ({ page, context }) => {
  const contacted = [];
  context.on("request", (request) => {
    if (googleHost.test(new URL(request.url()).hostname)) contacted.push(request.url());
  });
  await start(page); await stockClick(page);
  await page.locator("#pause").click();
  await page.waitForTimeout(4000);
  expect(await page.evaluate(() => "dataLayer" in window || "gtag" in window)).toBe(false);
  expect(await page.locator("script[src*='googletagmanager']").count()).toBe(0);
  const saved = await readSave(page);
  await context.setOffline(true); await page.close();
  const reopened = await context.newPage();
  await loaded(reopened);
  expect((await readSave(reopened)).board).toEqual(saved.board);
  expect(contacted).toEqual([]);
});

test("analytics CSP admits only the Google tag and its collection endpoints", async ({ page }) => {
  await page.route("https://www.googletagmanager.com/**", (route) => route.fulfill({
    contentType: "text/javascript", body: "window.__tagLoaded = true;",
  }));
  await page.route("https://region1.google-analytics.com/**", (route) => route.fulfill({ status: 204 }));
  await page.route("https://scripts.example.com/**", (route) => route.fulfill({
    contentType: "text/javascript", body: "window.__otherLoaded = true;",
  }));
  await loaded(page);
  const result = await page.evaluate(async () => {
    const script = (src) => new Promise((resolve) => {
      const node = document.createElement("script");
      node.src = src; node.onload = () => resolve("loaded"); node.onerror = () => resolve("blocked");
      document.head.append(node);
    });
    const beacon = await fetch("https://region1.google-analytics.com/g/collect", { method: "POST", mode: "no-cors" })
      .then(() => "sent", () => "blocked");
    const other = await fetch("https://scripts.example.com/collect", { mode: "no-cors" }).then(() => "sent", () => "blocked");
    return {
      tag: await script("https://www.googletagmanager.com/gtag/js?id=G-5PDTHH6KFT"),
      otherScript: await script("https://scripts.example.com/tag.js"),
      beacon, other,
      tagRan: window.__tagLoaded === true, otherRan: window.__otherLoaded === true,
    };
  });
  expect(result).toEqual({ tag: "loaded", otherScript: "blocked", beacon: "sent", other: "blocked", tagRan: true, otherRan: false });
});
