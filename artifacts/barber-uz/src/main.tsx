import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyTheme, type Theme } from "./hooks/useTheme";

// Apply saved theme before first render to avoid flash
const saved = (localStorage.getItem("barber_theme") as Theme) ?? "dark";
applyTheme(saved);

createRoot(document.getElementById("root")!).render(<App />);
