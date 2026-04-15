import { ReactNode, useEffect, useState } from "react";
import { BottomNav } from "./BottomNav";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

// ── Telegram soft popup logic ─────────────────────────────────────────────────

function isTelegramConnected(): boolean {
  try {
    const u = JSON.parse(localStorage.getItem("barber_user") || "null");
    return u?.telegramVerified === true;
  } catch {
    return false;
  }
}

function isLoggedIn(): boolean {
  return !!localStorage.getItem("barber_token");
}

function getSoftPopupDay(): number | null {
  if (!isLoggedIn() || isTelegramConnected()) return null;

  const firstSeenRaw = localStorage.getItem("barber_first_seen_ts");
  const now = Date.now();

  if (!firstSeenRaw) {
    localStorage.setItem("barber_first_seen_ts", String(now));
    return null;
  }

  const daysSince = Math.floor((now - Number(firstSeenRaw)) / (1000 * 60 * 60 * 24));

  let shown: number[] = [];
  try {
    shown = JSON.parse(localStorage.getItem("barber_tg_popups_shown") || "[]");
  } catch {
    shown = [];
  }

  if (daysSince >= 5 && !shown.includes(5)) return 5;
  if (daysSince >= 2 && !shown.includes(2)) return 2;

  return null;
}

function markPopupShown(day: number) {
  let shown: number[] = [];
  try {
    shown = JSON.parse(localStorage.getItem("barber_tg_popups_shown") || "[]");
  } catch {
    shown = [];
  }
  if (!shown.includes(day)) {
    shown.push(day);
    localStorage.setItem("barber_tg_popups_shown", JSON.stringify(shown));
  }
}

function TelegramSoftPopup({
  day,
  onConnect,
  onClose,
}: {
  day: number;
  onConnect: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: "spring", damping: 26, stiffness: 280 }}
        className="relative w-full max-w-sm bg-card border border-white/10 rounded-3xl p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-[#2AABEE]/10 border border-[#2AABEE]/20 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#2AABEE]">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.21-1.12-.33-1.08-.7.02-.19.27-.39.75-.59 2.95-1.28 4.91-2.13 5.89-2.52 2.8-1.13 3.38-1.33 3.76-1.33.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-foreground text-sm">🔔 Bronlarni o'tkazib yubormaslik uchun</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {day === 2 ? "Eslatma: 2-kun" : "Eslatma: 5-kun"}
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          Telegramni ulasangiz, yangi bronlar va bekor qilishlar haqida darhol xabar olasiz. Bitta bosish kifoya!
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={onConnect}
            className="w-full h-12 rounded-2xl font-bold text-white bg-[#2AABEE] hover:bg-[#229ED9] transition-all flex items-center justify-center gap-2 text-sm"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white shrink-0">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.21-1.12-.33-1.08-.7.02-.19.27-.39.75-.59 2.95-1.28 4.91-2.13 5.89-2.52 2.8-1.13 3.38-1.33 3.76-1.33.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z" />
            </svg>
            Ulanish
          </button>
          <button
            onClick={onClose}
            className="w-full h-10 rounded-2xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
          >
            Keyinroq
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function Layout({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const [popupDay, setPopupDay] = useState<number | null>(null);

  useEffect(() => {
    const day = getSoftPopupDay();
    if (day !== null) {
      const timer = setTimeout(() => setPopupDay(day), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  function handleConnect() {
    if (popupDay !== null) markPopupShown(popupDay);
    setPopupDay(null);
    navigate("/verify-telegram");
  }

  function handleClose() {
    if (popupDay !== null) markPopupShown(popupDay);
    setPopupDay(null);
  }

  return (
    <div className="min-h-screen bg-background relative pb-28">
      <main className="max-w-md mx-auto p-4 sm:p-6 w-full relative z-10">
        {children}
      </main>
      <BottomNav />

      <AnimatePresence>
        {popupDay !== null && (
          <TelegramSoftPopup
            day={popupDay}
            onConnect={handleConnect}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
