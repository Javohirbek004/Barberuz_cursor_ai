/** The app stays on the dark look. Light mode is not offered. */
export function applyTheme() {
  const root = document.documentElement;
  root.classList.remove("light");
  root.classList.add("dark");
  try {
    localStorage.setItem("barber_theme", "dark");
  } catch {
    /* storage can be blocked */
  }
}
