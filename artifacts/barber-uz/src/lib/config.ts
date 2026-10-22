const FALLBACK_ORIGIN = "https://barber-uz-clq6.onrender.com";
export const APP_ORIGIN = typeof window !== "undefined" && window.location?.origin
  ? window.location.origin
  : FALLBACK_ORIGIN;
export const APP_HOST = new URL(APP_ORIGIN).host;
export const APP_DISPLAY_HOST = APP_HOST;
