export const ONBOARDING_PENDING_KEY = "barber_onboarding_pending";
export const ONBOARDING_READY_KEY = "barber_page_ready";

/** Where a signed-in barber should land. New accounts finish the 7 screens first. */
export function pathAfterAuth(): string {
  try {
    if (localStorage.getItem(ONBOARDING_PENDING_KEY) === "1" && localStorage.getItem("barber_token")) {
      return "/onboarding";
    }
  } catch {
    /* storage can be blocked */
  }
  return "/dashboard";
}
