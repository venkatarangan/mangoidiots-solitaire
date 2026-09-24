const MEASUREMENT_ID = "G-5PDTHH6KFT";
const PRODUCTION_HOST = "solitaire.mangoidiots.com";

type PrivacyNavigator = Navigator & { doNotTrack?: string | null; globalPrivacyControl?: boolean };
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

let started = false;

function declined(): boolean {
  const privacy = navigator as PrivacyNavigator;
  return privacy.globalPrivacyControl === true || privacy.doNotTrack === "1";
}

function load(): void {
  try {
    if (!navigator.onLine) return;
    const target = window as AnalyticsWindow;
    const dataLayer = target.dataLayer = target.dataLayer || [];
    // gtag.js only recognises the original `arguments` object, not an array copy.
    target.gtag = function gtag() { dataLayer.push(arguments); };
    target.gtag("consent", "default", {
      ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted",
    });
    target.gtag("js", new Date());
    target.gtag("config", MEASUREMENT_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    script.onerror = () => script.remove();
    document.head.append(script);
  } catch {
    // Analytics is optional; the game never depends on it.
  }
}

export function startAnalytics(): void {
  try {
    if (started || location.hostname !== PRODUCTION_HOST || declined()) return;
    started = true;
    if ("requestIdleCallback" in window) requestIdleCallback(load, { timeout: 10000 });
    else setTimeout(load, 3000);
  } catch {
    // Analytics is optional; the game never depends on it.
  }
}
