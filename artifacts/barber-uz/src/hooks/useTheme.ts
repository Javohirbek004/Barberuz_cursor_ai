import { useState, useEffect } from "react";

export type Theme = "system" | "light" | "dark";

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.add(prefersDark ? "dark" : "light");
  } else {
    root.classList.add(theme);
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("barber_theme") as Theme) ?? "dark";
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const changeTheme = (t: Theme) => {
    localStorage.setItem("barber_theme", t);
    setTheme(t);
    applyTheme(t);
  };

  return { theme, changeTheme };
}
