const PROD_ORIGIN = "https://barberuz.replit.app";
export const APP_ORIGIN = import.meta.env.DEV
  ? window.location.origin
  : PROD_ORIGIN;
export const APP_HOST = new URL(APP_ORIGIN).host;
export const APP_DISPLAY_HOST = new URL(PROD_ORIGIN).host;
