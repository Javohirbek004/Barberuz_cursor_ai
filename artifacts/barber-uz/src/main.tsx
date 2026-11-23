import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyTheme } from "./hooks/useTheme";

// Dark look only. A previously saved light choice is cleared here.
applyTheme();

// Remember a return from the bot before any page code can drop the address.
try {
  const params = new URLSearchParams(window.location.search);
  if (params.get("bot") === "ulandi") {
    sessionStorage.setItem("zumio_show_bot_toast", "1");
    params.delete("bot");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", next);
  }
} catch { /* storage can be blocked */ }

createRoot(document.getElementById("root")!).render(<App />);
