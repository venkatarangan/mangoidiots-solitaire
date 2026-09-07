import { test as base, webkit } from "@playwright/test";
export { expect } from "@playwright/test";

export const test = base.extend({
  context: async ({ context, browserName, viewport, deviceScaleFactor, reducedMotion, baseURL }, use, testInfo) => {
    if (browserName !== "webkit" || process.platform !== "win32") return use(context);
    // Windows WebKit's ephemeral contexts lose even a single Cache.put entry on navigation.
    const persistent = await webkit.launchPersistentContext(testInfo.outputPath("webkit-profile"), {
      viewport, deviceScaleFactor, reducedMotion, baseURL,
    });
    try { await use(persistent); }
    finally { await persistent.close(); }
  },
});
