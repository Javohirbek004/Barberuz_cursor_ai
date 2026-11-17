export const ONBOARDING_PENDING_KEY = "barber_onboarding_pending";
export const ONBOARDING_READY_KEY = "barber_page_ready";
export const ONBOARDING_INTRO_KEY = "barber_onboarding_intro";
export const ONBOARDING_COMPLETED_KEY = "onboarding_completed";
export const ONBOARDING_GREET_KEY = "barber_onboarding_greet";
export const ONBOARDING_HINT_KEY = "barber_onboarding_hint";

/** Where a signed-in barber should land. New accounts finish the 6 screens first. */
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
